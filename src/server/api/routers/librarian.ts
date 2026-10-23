import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth/api";
import { z } from "zod";
import type { AuthorName } from "~/lib/library-rules";
import {
	addDays,
	COPY_AVAILABILITY_SELECT,
	getBorrowBlockReason,
	isCopyOnLoan,
	isForeignKeyViolation,
	isUniqueViolation,
	LOAN_DAYS,
	LOANABLE_COPY_WHERE,
	parseAuthorsText,
} from "~/lib/library-rules";
import { isValidPesel, normalizePesel } from "~/lib/pesel";
import {
	assertPublisherAddress,
	assertUserAddress,
	publisherAddressShape,
	userAddressShape,
} from "~/server/api/address";
import { createTRPCRouter, librarianProcedure } from "~/server/api/trpc";
import { auth } from "~/server/better-auth";
import type { Prisma } from "../../../../generated/prisma/client";

const pageSizeSchema = z.union([z.literal(50), z.literal(100), z.literal(200)]);
const optionalQ = z
	.string()
	.trim()
	.max(200)
	.optional()
	.transform((value) => (value ? value : undefined));

const paginationInput = z.object({
	page: z.number().int().min(1).default(1),
	pageSize: pageSizeSchema.default(50),
	q: optionalQ,
});

const copyStatusManual = z.enum(["AVAILABLE", "LOST", "MAINTENANCE"]);

const languageCodeSchema = z
	.string()
	.trim()
	.regex(/^[a-z]{2}$/, "Nieprawidłowy kod języka");
const countryCodeSchema = z
	.string()
	.trim()
	.regex(/^[A-Z]{2}$/, "Nieprawidłowy kod kraju");

/** Optional free-text field: empty string is stored as NULL. */
function optionalText(max: number) {
	return z
		.string()
		.trim()
		.max(max)
		.nullable()
		.transform((value) => (value ? value : null));
}

const workWriteInput = z.object({
	title: z.string().trim().min(1).max(500),
	originalTitle: optionalText(500),
	description: optionalText(5000),
	originalYear: z.number().int().min(-3000).max(2100).nullable(),
	originalLanguageCode: languageCodeSchema,
	authors: z.string().trim().max(1000),
	genreIds: z.array(z.string().min(1)).max(20),
});

const editionWriteInput = z.object({
	ean: z.string().trim().min(1).max(32),
	pageCount: z.number().int().min(1).max(50_000),
	publicationYear: z.number().int().min(1000).max(2100),
	languageCode: languageCodeSchema,
	format: z.enum(["HARDCOVER", "PAPERBACK"]),
	publisherName: z.string().trim().min(1).max(200),
});

const authorWriteInput = z.object({
	firstName: z.string().trim().min(1).max(100),
	lastName: z.string().trim().min(1).max(100),
	countryCode: countryCodeSchema.nullable(),
	birthYear: z.number().int().min(-3000).max(2100).nullable(),
	genreIds: z.array(z.string().min(1)).max(20),
});

const publisherWriteInput = z.object({
	name: z.string().trim().min(1).max(200),
	countryCode: countryCodeSchema.nullable(),
	...publisherAddressShape,
	email: z
		.string()
		.trim()
		.max(200)
		.nullable()
		.transform((value) => (value ? value : null))
		.pipe(z.string().email("Nieprawidłowy adres e-mail").nullable()),
	website: z
		.string()
		.trim()
		.max(300)
		.nullable()
		.transform((value) => (value ? value : null))
		.pipe(
			z
				.string()
				.regex(/^https?:\/\//, "Adres strony musi zaczynać się od http(s)://")
				.nullable(),
		),
});

async function resolvePublisherId(
	tx: Prisma.TransactionClient,
	name: string,
): Promise<string> {
	const existing = await tx.publisher.findFirst({
		where: { name: { equals: name, mode: "insensitive" } },
		select: { id: true },
	});
	if (existing) return existing.id;

	const created = await tx.publisher.create({
		data: { name },
		select: { id: true },
	});
	return created.id;
}

async function resolveAuthorId(
	tx: Prisma.TransactionClient,
	author: AuthorName,
): Promise<string> {
	const existing = await tx.author.findFirst({
		where: {
			firstName: { equals: author.firstName, mode: "insensitive" },
			lastName: { equals: author.lastName, mode: "insensitive" },
		},
		select: { id: true },
	});
	if (existing) return existing.id;

	const created = await tx.author.create({
		data: {
			firstName: author.firstName,
			lastName: author.lastName,
		},
		select: { id: true },
	});
	return created.id;
}

async function resolveAuthorIds(
	tx: Prisma.TransactionClient,
	authorsText: string,
): Promise<string[]> {
	const authorIds: string[] = [];
	for (const author of parseAuthorsText(authorsText)) {
		authorIds.push(await resolveAuthorId(tx, author));
	}
	return authorIds;
}

async function assertEanFree(
	db: Prisma.TransactionClient | typeof import("~/server/db").db,
	ean: string,
	exceptId?: string,
) {
	const conflict = await db.edition.findFirst({
		where: {
			ean,
			...(exceptId ? { NOT: { id: exceptId } } : {}),
		},
		select: { id: true },
	});
	if (conflict) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Wydanie o tym EAN już istnieje",
		});
	}
}

/** Maps an FK violation (unknown country/language code) to a user-facing error. */
async function withDictionaryCheck<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		if (isForeignKeyViolation(error)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Nieznany kod kraju lub języka",
			});
		}
		throw error;
	}
}

async function assertPublisherNameFree(
	db: Prisma.TransactionClient | typeof import("~/server/db").db,
	name: string,
	exceptId?: string,
) {
	const existing = await db.publisher.findFirst({
		where: {
			name: { equals: name, mode: "insensitive" },
			...(exceptId ? { NOT: { id: exceptId } } : {}),
		},
		select: { id: true },
	});
	if (existing) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Wydawnictwo o tej nazwie już istnieje",
		});
	}
}

const languageSelect = { select: { code: true, name: true } } as const;

const authorInclude = {
	orderBy: { authorOrder: "asc" },
	include: {
		author: {
			select: {
				id: true,
				firstName: true,
				lastName: true,
			},
		},
	},
} satisfies Prisma.Work$authorsArgs;

function userSearchWhere(q: string): Prisma.UserWhereInput {
	return {
		OR: [
			{ email: { contains: q, mode: "insensitive" } },
			{ firstName: { contains: q, mode: "insensitive" } },
			{ lastName: { contains: q, mode: "insensitive" } },
			{ name: { contains: q, mode: "insensitive" } },
		],
	};
}

async function assertMemberCanBorrow(
	db: {
		user: { findUnique: typeof import("~/server/db").db.user.findUnique };
		loan: { count: typeof import("~/server/db").db.loan.count };
	},
	userId: string,
) {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { id: true, isActive: true, role: true },
	});

	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Nie znaleziono czytelnika",
		});
	}

	const now = new Date();
	const [activeCount, overdueCount] = await Promise.all([
		db.loan.count({
			where: { userId, returnedAt: null },
		}),
		db.loan.count({
			where: {
				userId,
				returnedAt: null,
				dueAt: { lt: now },
			},
		}),
	]);

	const block = getBorrowBlockReason({
		isActive: user.isActive,
		activeCount,
		overdueCount,
	});
	if (block) {
		throw new TRPCError(block);
	}

	return user;
}

async function createLoanForCopy(
	db: Prisma.TransactionClient,
	params: { copyId: string; userId: string },
) {
	await assertMemberCanBorrow(db, params.userId);

	const copy = await db.copy.findUnique({
		where: { id: params.copyId },
		select: {
			id: true,
			status: true,
			inventoryNo: true,
			edition: { select: { workId: true } },
		},
	});

	if (!copy) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Nie znaleziono egzemplarza",
		});
	}

	if (copy.status !== "AVAILABLE") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Egzemplarz nie jest dostępny",
		});
	}

	const activeOnCopy = await db.loan.findFirst({
		where: { copyId: copy.id, returnedAt: null },
		select: { id: true },
	});

	if (activeOnCopy) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Egzemplarz ma już aktywne wypożyczenie",
		});
	}

	const now = new Date();
	let loan: { id: string };
	try {
		loan = await db.loan.create({
			data: {
				copyId: copy.id,
				userId: params.userId,
				loanedAt: now,
				dueAt: addDays(now, LOAN_DAYS),
			},
			select: { id: true },
		});
	} catch (error) {
		// Wyścig dwóch wypożyczeń tego samego egzemplarza — odrzuca je indeks
		// loan_one_active_per_copy w bazie.
		if (isUniqueViolation(error)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Egzemplarz ma już aktywne wypożyczenie",
			});
		}
		throw error;
	}

	// Wypożyczenie zarezerwowanej książki realizuje rezerwację czytelnika.
	await db.reservation.updateMany({
		where: {
			userId: params.userId,
			workId: copy.edition.workId,
			status: "PENDING",
		},
		data: { status: "FULFILLED", closedAt: new Date() },
	});

	return {
		loanId: loan.id,
		workId: copy.edition.workId,
		inventoryNo: copy.inventoryNo,
	};
}

const genreNameSchema = z.string().trim().min(1).max(100);

async function assertGenreNameFree(
	db: Prisma.TransactionClient | typeof import("~/server/db").db,
	name: string,
	exceptId?: string,
) {
	const existing = await db.genre.findFirst({
		where: {
			name: { equals: name, mode: "insensitive" },
			...(exceptId ? { NOT: { id: exceptId } } : {}),
		},
		select: { id: true },
	});
	if (existing) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Gatunek o tej nazwie już istnieje",
		});
	}
}

export const librarianRouter = createTRPCRouter({
	listActiveLoans: librarianProcedure
		.input(paginationInput.extend({ overdueOnly: z.boolean().optional() }))
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q, overdueOnly } = input;
			const skip = (page - 1) * pageSize;
			const now = new Date();

			const where: Prisma.LoanWhereInput = { returnedAt: null };
			if (overdueOnly) {
				where.dueAt = { lt: now };
			}
			if (q) {
				where.OR = [
					{ copy: { inventoryNo: { contains: q, mode: "insensitive" } } },
					{
						copy: {
							edition: {
								work: { title: { contains: q, mode: "insensitive" } },
							},
						},
					},
					{ copy: { edition: { ean: { contains: q, mode: "insensitive" } } } },
					{ user: userSearchWhere(q) },
				];
			}

			const [total, overdueTotal, loans] = await Promise.all([
				ctx.db.loan.count({ where }),
				ctx.db.loan.count({
					where: { returnedAt: null, dueAt: { lt: now } },
				}),
				ctx.db.loan.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { dueAt: "asc" },
					include: {
						user: {
							select: {
								id: true,
								email: true,
								firstName: true,
								lastName: true,
							},
						},
						copy: {
							select: {
								id: true,
								inventoryNo: true,
								edition: {
									select: {
										id: true,
										ean: true,
										work: { select: { id: true, title: true } },
									},
								},
							},
						},
					},
				}),
			]);

			return {
				total,
				overdueTotal,
				page,
				pageSize,
				items: loans.map((loan) => ({
					id: loan.id,
					loanedAt: loan.loanedAt,
					dueAt: loan.dueAt,
					overdue: loan.dueAt < now,
					user: loan.user,
					inventoryNo: loan.copy.inventoryNo,
					copyId: loan.copy.id,
					work: loan.copy.edition.work,
					edition: { id: loan.copy.edition.id, ean: loan.copy.edition.ean },
				})),
			};
		}),

	listActiveReservations: librarianProcedure
		.input(paginationInput)
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q } = input;
			const skip = (page - 1) * pageSize;

			const where: Prisma.ReservationWhereInput = { status: "PENDING" };
			if (q) {
				where.OR = [
					{ work: { title: { contains: q, mode: "insensitive" } } },
					{
						work: {
							editions: {
								some: { ean: { contains: q, mode: "insensitive" } },
							},
						},
					},
					{ user: userSearchWhere(q) },
				];
			}

			const [total, reservations] = await Promise.all([
				ctx.db.reservation.count({ where }),
				ctx.db.reservation.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { createdAt: "asc" },
					include: {
						user: {
							select: {
								id: true,
								email: true,
								firstName: true,
								lastName: true,
							},
						},
						work: {
							select: { id: true, title: true },
						},
					},
				}),
			]);

			return {
				total,
				page,
				pageSize,
				items: reservations.map((r) => ({
					id: r.id,
					createdAt: r.createdAt,
					user: r.user,
					work: r.work,
				})),
			};
		}),

	listLoanHistory: librarianProcedure
		.input(paginationInput)
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q } = input;
			const skip = (page - 1) * pageSize;

			const where: Prisma.LoanWhereInput = {
				returnedAt: { not: null },
			};
			if (q) {
				where.OR = [
					{ copy: { inventoryNo: { contains: q, mode: "insensitive" } } },
					{
						copy: {
							edition: {
								work: { title: { contains: q, mode: "insensitive" } },
							},
						},
					},
					{ copy: { edition: { ean: { contains: q, mode: "insensitive" } } } },
					{ user: userSearchWhere(q) },
				];
			}

			const [total, loans] = await Promise.all([
				ctx.db.loan.count({ where }),
				ctx.db.loan.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { returnedAt: "desc" },
					include: {
						user: {
							select: {
								id: true,
								email: true,
								firstName: true,
								lastName: true,
							},
						},
						copy: {
							select: {
								id: true,
								inventoryNo: true,
								edition: {
									select: {
										id: true,
										ean: true,
										work: { select: { id: true, title: true } },
									},
								},
							},
						},
					},
				}),
			]);

			return {
				total,
				page,
				pageSize,
				items: loans.flatMap((loan) => {
					if (!loan.returnedAt) return [];
					return [
						{
							id: loan.id,
							loanedAt: loan.loanedAt,
							dueAt: loan.dueAt,
							returnedAt: loan.returnedAt,
							user: loan.user,
							inventoryNo: loan.copy.inventoryNo,
							copyId: loan.copy.id,
							work: loan.copy.edition.work,
							edition: {
								id: loan.copy.edition.id,
								ean: loan.copy.edition.ean,
							},
						},
					];
				}),
			};
		}),

	listReservationHistory: librarianProcedure
		.input(
			paginationInput.extend({
				status: z.enum(["FULFILLED", "CANCELLED"]).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q, status } = input;
			const skip = (page - 1) * pageSize;

			const where: Prisma.ReservationWhereInput = status
				? { status }
				: { status: { in: ["FULFILLED", "CANCELLED"] } };

			if (q) {
				where.OR = [
					{ work: { title: { contains: q, mode: "insensitive" } } },
					{
						work: {
							editions: {
								some: { ean: { contains: q, mode: "insensitive" } },
							},
						},
					},
					{ user: userSearchWhere(q) },
				];
			}

			const [total, reservations] = await Promise.all([
				ctx.db.reservation.count({ where }),
				ctx.db.reservation.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { closedAt: "desc" },
					include: {
						user: {
							select: {
								id: true,
								email: true,
								firstName: true,
								lastName: true,
							},
						},
						work: {
							select: { id: true, title: true },
						},
					},
				}),
			]);

			return {
				total,
				page,
				pageSize,
				items: reservations.map((r) => ({
					id: r.id,
					status: r.status,
					createdAt: r.createdAt,
					closedAt: r.closedAt,
					user: r.user,
					work: r.work,
				})),
			};
		}),

	listWorks: librarianProcedure
		.input(
			paginationInput.extend({
				authorId: z.string().trim().optional(),
				publisherId: z.string().trim().optional(),
				genreId: z.string().trim().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q } = input;
			const skip = (page - 1) * pageSize;
			const and: Prisma.WorkWhereInput[] = [];

			if (q) {
				and.push({
					OR: [
						{ title: { contains: q, mode: "insensitive" } },
						{
							editions: {
								some: {
									OR: [
										{ ean: { contains: q, mode: "insensitive" } },
										{
											publisher: {
												name: { contains: q, mode: "insensitive" },
											},
										},
									],
								},
							},
						},
					],
				});
			}

			if (input.authorId) {
				and.push({ authors: { some: { authorId: input.authorId } } });
			}
			if (input.publisherId) {
				and.push({
					editions: { some: { publisherId: input.publisherId } },
				});
			}
			if (input.genreId) {
				and.push({
					genres: { some: { genreId: input.genreId } },
				});
			}

			const where: Prisma.WorkWhereInput = and.length > 0 ? { AND: and } : {};

			const [total, works] = await Promise.all([
				ctx.db.work.count({ where }),
				ctx.db.work.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { title: "asc" },
					include: {
						authors: authorInclude,
						originalLanguage: languageSelect,
						editions: {
							select: { _count: { select: { copies: true } } },
						},
					},
				}),
			]);

			return {
				total,
				page,
				pageSize,
				items: works.map((work) => ({
					id: work.id,
					title: work.title,
					originalTitle: work.originalTitle,
					originalYear: work.originalYear,
					originalLanguage: work.originalLanguage,
					authors: work.authors.map((wa) => wa.author),
					editionsCount: work.editions.length,
					copiesCount: work.editions.reduce(
						(sum, e) => sum + e._count.copies,
						0,
					),
				})),
			};
		}),

	getWork: librarianProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const work = await ctx.db.work.findUnique({
				where: { id: input.id },
				include: {
					authors: authorInclude,
					originalLanguage: languageSelect,
					genres: {
						include: {
							genre: { select: { id: true, name: true } },
						},
					},
					editions: {
						orderBy: [{ publicationYear: "desc" }, { ean: "asc" }],
						include: {
							publisher: { select: { id: true, name: true } },
							language: languageSelect,
							_count: { select: { copies: true } },
						},
					},
				},
			});

			if (!work) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono pozycji",
				});
			}

			return {
				id: work.id,
				title: work.title,
				originalTitle: work.originalTitle,
				description: work.description,
				originalYear: work.originalYear,
				originalLanguage: work.originalLanguage,
				authors: work.authors.map((wa) => wa.author),
				genres: work.genres.map((wc) => wc.genre),
				editions: work.editions.map((edition) => ({
					id: edition.id,
					ean: edition.ean,
					pageCount: edition.pageCount,
					publicationYear: edition.publicationYear,
					language: edition.language,
					format: edition.format,
					publisher: edition.publisher,
					copiesCount: edition._count.copies,
				})),
			};
		}),

	getEditionWithCopies: librarianProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const edition = await ctx.db.edition.findUnique({
				where: { id: input.id },
				include: {
					publisher: { select: { id: true, name: true } },
					language: languageSelect,
					copies: {
						orderBy: { inventoryNo: "asc" },
						select: {
							id: true,
							inventoryNo: true,
							...COPY_AVAILABILITY_SELECT,
						},
					},
				},
			});

			if (!edition) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono wydania",
				});
			}

			return {
				id: edition.id,
				workId: edition.workId,
				ean: edition.ean,
				pageCount: edition.pageCount,
				publicationYear: edition.publicationYear,
				language: edition.language,
				format: edition.format,
				publisher: edition.publisher,
				copies: edition.copies.map((copy) => ({
					id: copy.id,
					inventoryNo: copy.inventoryNo,
					status: copy.status,
					onLoan: isCopyOnLoan(copy),
				})),
			};
		}),

	returnLoan: librarianProcedure
		.input(z.object({ loanId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.$transaction(async (tx) => {
				const loan = await tx.loan.findUnique({
					where: { id: input.loanId },
					select: { id: true, returnedAt: true },
				});

				if (!loan) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Nie znaleziono wypożyczenia",
					});
				}

				if (loan.returnedAt) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Wypożyczenie jest już zwrócone",
					});
				}

				// Status egzemplarza się nie zmienia — o dostępności decyduje brak
				// aktywnego wypożyczenia.
				await tx.loan.update({
					where: { id: loan.id },
					data: { returnedAt: new Date() },
				});
			});

			return { ok: true as const };
		}),

	cancelReservation: librarianProcedure
		.input(z.object({ reservationId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const reservation = await ctx.db.reservation.findUnique({
				where: { id: input.reservationId },
				select: { id: true, status: true },
			});

			if (!reservation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono rezerwacji",
				});
			}

			if (reservation.status !== "PENDING") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Rezerwacja nie jest aktywna",
				});
			}

			await ctx.db.reservation.update({
				where: { id: reservation.id },
				data: { status: "CANCELLED", closedAt: new Date() },
			});

			return { ok: true as const };
		}),

	fulfillReservation: librarianProcedure
		.input(z.object({ reservationId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.$transaction(async (tx) => {
				const reservation = await tx.reservation.findUnique({
					where: { id: input.reservationId },
					select: {
						id: true,
						status: true,
						workId: true,
						userId: true,
					},
				});

				if (!reservation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Nie znaleziono rezerwacji",
					});
				}

				if (reservation.status !== "PENDING") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Rezerwacja nie jest aktywna",
					});
				}

				const availableCopy = await tx.copy.findFirst({
					where: {
						edition: { workId: reservation.workId },
						...LOANABLE_COPY_WHERE,
					},
					select: { id: true },
					orderBy: { inventoryNo: "asc" },
				});

				if (!availableCopy) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Brak dostępnego egzemplarza do realizacji",
					});
				}

				// createLoanForCopy ustawia też status rezerwacji na FULFILLED.
				const loan = await createLoanForCopy(tx, {
					copyId: availableCopy.id,
					userId: reservation.userId,
				});

				return { ok: true as const, loanId: loan.loanId };
			});
		}),

	createLoan: librarianProcedure
		.input(
			z.object({
				copyId: z.string().min(1).optional(),
				inventoryNo: z.string().trim().min(1).optional(),
				userId: z.string().min(1).optional(),
				userEmail: z.string().trim().email().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.userId && !input.userEmail) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Podaj identyfikator lub e-mail czytelnika",
				});
			}
			if (!input.copyId && !input.inventoryNo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Podaj ID egzemplarza lub numer inwentarzowy",
				});
			}

			let resolvedUserId = input.userId;
			if (!resolvedUserId && input.userEmail) {
				const user = await ctx.db.user.findUnique({
					where: { email: input.userEmail },
					select: { id: true },
				});
				if (!user) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Nie znaleziono czytelnika o podanym e-mailu",
					});
				}
				resolvedUserId = user.id;
			}

			let resolvedCopyId = input.copyId;
			if (!resolvedCopyId && input.inventoryNo) {
				const copy = await ctx.db.copy.findUnique({
					where: { inventoryNo: input.inventoryNo },
					select: { id: true },
				});
				if (!copy) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Nie znaleziono egzemplarza o podanym numerze",
					});
				}
				resolvedCopyId = copy.id;
			}

			if (!resolvedUserId || !resolvedCopyId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Brak wymaganych danych wypożyczenia",
				});
			}

			const userId = resolvedUserId;
			const copyId = resolvedCopyId;

			return ctx.db.$transaction(async (tx) => {
				const result = await createLoanForCopy(tx, {
					copyId,
					userId,
				});
				return { ok: true as const, loanId: result.loanId };
			});
		}),

	createWork: librarianProcedure
		.input(workWriteInput)
		.mutation(async ({ ctx, input }) => {
			return withDictionaryCheck(() =>
				ctx.db.$transaction(async (tx) => {
					const authorIds = await resolveAuthorIds(tx, input.authors);

					return tx.work.create({
						data: {
							title: input.title,
							originalTitle: input.originalTitle,
							description: input.description,
							originalYear: input.originalYear,
							originalLanguageCode: input.originalLanguageCode,
							authors: {
								create: authorIds.map((authorId, index) => ({
									authorId,
									authorOrder: index + 1,
								})),
							},
							genres: {
								create: input.genreIds.map((genreId) => ({
									genreId,
								})),
							},
						},
						select: { id: true },
					});
				}),
			);
		}),

	updateWork: librarianProcedure
		.input(workWriteInput.extend({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await withDictionaryCheck(() =>
				ctx.db.$transaction(async (tx) => {
					const work = await tx.work.findUnique({
						where: { id: input.id },
						select: { id: true },
					});
					if (!work) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Nie znaleziono pozycji",
						});
					}

					const authorIds = await resolveAuthorIds(tx, input.authors);

					await tx.workAuthor.deleteMany({ where: { workId: input.id } });
					await tx.workGenre.deleteMany({ where: { workId: input.id } });

					await tx.work.update({
						where: { id: input.id },
						data: {
							title: input.title,
							originalTitle: input.originalTitle,
							description: input.description,
							originalYear: input.originalYear,
							originalLanguageCode: input.originalLanguageCode,
							authors: {
								create: authorIds.map((authorId, index) => ({
									authorId,
									authorOrder: index + 1,
								})),
							},
							genres: {
								create: input.genreIds.map((genreId) => ({
									genreId,
								})),
							},
						},
					});
				}),
			);

			return { ok: true as const };
		}),

	deleteWork: librarianProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const work = await ctx.db.work.findUnique({
				where: { id: input.workId },
				select: {
					id: true,
					_count: { select: { editions: true } },
				},
			});

			if (!work) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono pozycji",
				});
			}

			if (work._count.editions > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Najpierw usuń wszystkie wydania tej pozycji",
				});
			}

			const pending = await ctx.db.reservation.count({
				where: { workId: work.id, status: "PENDING" },
			});
			if (pending > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Pozycja ma aktywne rezerwacje — najpierw je anuluj",
				});
			}

			await ctx.db.work.delete({ where: { id: work.id } });
			return { ok: true as const };
		}),

	createEdition: librarianProcedure
		.input(editionWriteInput.extend({ workId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const work = await ctx.db.work.findUnique({
				where: { id: input.workId },
				select: { id: true },
			});
			if (!work) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono pozycji",
				});
			}

			await assertEanFree(ctx.db, input.ean);

			return withDictionaryCheck(() =>
				ctx.db.$transaction(async (tx) => {
					const publisherId = await resolvePublisherId(tx, input.publisherName);

					return tx.edition.create({
						data: {
							workId: input.workId,
							ean: input.ean,
							pageCount: input.pageCount,
							publicationYear: input.publicationYear,
							languageCode: input.languageCode,
							format: input.format,
							publisherId,
						},
						select: { id: true },
					});
				}),
			);
		}),

	updateEdition: librarianProcedure
		.input(editionWriteInput.extend({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await assertEanFree(ctx.db, input.ean, input.id);

			await withDictionaryCheck(() =>
				ctx.db.$transaction(async (tx) => {
					const edition = await tx.edition.findUnique({
						where: { id: input.id },
						select: { id: true },
					});
					if (!edition) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Nie znaleziono wydania",
						});
					}

					const publisherId = await resolvePublisherId(tx, input.publisherName);

					await tx.edition.update({
						where: { id: input.id },
						data: {
							ean: input.ean,
							pageCount: input.pageCount,
							publicationYear: input.publicationYear,
							languageCode: input.languageCode,
							format: input.format,
							publisherId,
						},
					});
				}),
			);

			return { ok: true as const };
		}),

	deleteEdition: librarianProcedure
		.input(z.object({ editionId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const edition = await ctx.db.edition.findUnique({
				where: { id: input.editionId },
				select: {
					id: true,
					_count: { select: { copies: true } },
				},
			});

			if (!edition) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono wydania",
				});
			}

			if (edition._count.copies > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Najpierw usuń wszystkie egzemplarze tego wydania",
				});
			}

			await ctx.db.edition.delete({ where: { id: edition.id } });
			return { ok: true as const };
		}),

	addCopy: librarianProcedure
		.input(
			z.object({
				editionId: z.string().min(1),
				inventoryNo: z.string().trim().min(1).max(64),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const edition = await ctx.db.edition.findUnique({
				where: { id: input.editionId },
				select: { id: true },
			});
			if (!edition) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono wydania",
				});
			}

			const conflict = await ctx.db.copy.findUnique({
				where: { inventoryNo: input.inventoryNo },
				select: { id: true },
			});
			if (conflict) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Numer inwentarzowy jest już zajęty",
				});
			}

			const copy = await ctx.db.copy.create({
				data: {
					editionId: input.editionId,
					inventoryNo: input.inventoryNo,
					status: "AVAILABLE",
				},
				select: { id: true, inventoryNo: true, status: true },
			});

			return copy;
		}),

	updateCopyStatus: librarianProcedure
		.input(
			z.object({
				copyId: z.string().min(1),
				status: copyStatusManual,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const copy = await ctx.db.copy.findUnique({
				where: { id: input.copyId },
				select: {
					id: true,
					status: true,
					loans: {
						where: { returnedAt: null },
						select: { id: true },
						take: 1,
					},
				},
			});

			if (!copy) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono egzemplarza",
				});
			}

			if (isCopyOnLoan(copy)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Nie można zmieniać statusu wypożyczonego egzemplarza — najpierw zarejestruj zwrot",
				});
			}

			await ctx.db.copy.update({
				where: { id: copy.id },
				data: { status: input.status },
			});

			return { ok: true as const };
		}),

	deleteCopy: librarianProcedure
		.input(z.object({ copyId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const copy = await ctx.db.copy.findUnique({
				where: { id: input.copyId },
				select: { id: true, _count: { select: { loans: true } } },
			});

			if (!copy) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono egzemplarza",
				});
			}

			if (copy._count.loans > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Egzemplarz ma historię wypożyczeń — nie można go usunąć. Ustaw status LOST.",
				});
			}

			await ctx.db.copy.delete({ where: { id: copy.id } });
			return { ok: true as const };
		}),

	listGenres: librarianProcedure.query(async ({ ctx }) => {
		const genres = await ctx.db.genre.findMany({
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				_count: { select: { works: true } },
			},
		});
		return genres.map((c) => ({
			id: c.id,
			name: c.name,
			worksCount: c._count.works,
		}));
	}),

	createGenre: librarianProcedure
		.input(z.object({ name: genreNameSchema }))
		.mutation(async ({ ctx, input }) => {
			await assertGenreNameFree(ctx.db, input.name);
			return ctx.db.genre.create({
				data: { name: input.name },
				select: { id: true, name: true },
			});
		}),

	renameGenre: librarianProcedure
		.input(z.object({ id: z.string().min(1), name: genreNameSchema }))
		.mutation(async ({ ctx, input }) => {
			const genre = await ctx.db.genre.findUnique({
				where: { id: input.id },
				select: { id: true },
			});
			if (!genre) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono gatunku",
				});
			}
			await assertGenreNameFree(ctx.db, input.name, input.id);
			await ctx.db.genre.update({
				where: { id: input.id },
				data: { name: input.name },
			});
			return { ok: true as const };
		}),

	deleteGenre: librarianProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const genre = await ctx.db.genre.findUnique({
				where: { id: input.id },
				select: { id: true, _count: { select: { works: true } } },
			});
			if (!genre) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono gatunku",
				});
			}
			if (genre._count.works > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Gatunek jest przypisany do ${genre._count.works} pozycji — nie można go usunąć`,
				});
			}
			await ctx.db.genre.delete({ where: { id: input.id } });
			return { ok: true as const };
		}),

	listAuthors: librarianProcedure
		.input(paginationInput)
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q } = input;
			const where: Prisma.AuthorWhereInput = q
				? {
						OR: [
							{ firstName: { contains: q, mode: "insensitive" } },
							{ lastName: { contains: q, mode: "insensitive" } },
						],
					}
				: {};

			const [total, authors] = await Promise.all([
				ctx.db.author.count({ where }),
				ctx.db.author.findMany({
					where,
					skip: (page - 1) * pageSize,
					take: pageSize,
					orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
					include: {
						country: { select: { code: true, name: true } },
						genres: {
							orderBy: { genre: { name: "asc" } },
							select: { genre: { select: { id: true, name: true } } },
						},
						_count: { select: { works: true } },
					},
				}),
			]);

			return {
				total,
				page,
				pageSize,
				items: authors.map((a) => ({
					id: a.id,
					firstName: a.firstName,
					lastName: a.lastName,
					birthYear: a.birthYear,
					country: a.country,
					genres: a.genres.map((ag) => ag.genre),
					worksCount: a._count.works,
				})),
			};
		}),

	createAuthor: librarianProcedure
		.input(authorWriteInput)
		.mutation(async ({ ctx, input }) => {
			const { genreIds, ...data } = input;
			return withDictionaryCheck(() =>
				ctx.db.author.create({
					data: {
						...data,
						genres: { create: genreIds.map((genreId) => ({ genreId })) },
					},
					select: { id: true },
				}),
			);
		}),

	updateAuthor: librarianProcedure
		.input(authorWriteInput.extend({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const { id, genreIds, ...data } = input;
			const author = await ctx.db.author.findUnique({
				where: { id },
				select: { id: true },
			});
			if (!author) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono autora",
				});
			}
			await withDictionaryCheck(() =>
				ctx.db.author.update({
					where: { id },
					data: {
						...data,
						genres: {
							deleteMany: {},
							create: genreIds.map((genreId) => ({ genreId })),
						},
					},
				}),
			);
			return { ok: true as const };
		}),

	deleteAuthor: librarianProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const author = await ctx.db.author.findUnique({
				where: { id: input.id },
				select: { id: true, _count: { select: { works: true } } },
			});
			if (!author) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono autora",
				});
			}
			if (author._count.works > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Autor jest przypisany do ${author._count.works} pozycji — nie można go usunąć`,
				});
			}
			await ctx.db.author.delete({ where: { id: input.id } });
			return { ok: true as const };
		}),

	listPublishers: librarianProcedure
		.input(paginationInput)
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q } = input;
			const where: Prisma.PublisherWhereInput = q
				? {
						OR: [
							{ name: { contains: q, mode: "insensitive" } },
							{ street: { contains: q, mode: "insensitive" } },
							{ postalCode: { contains: q } },
							{ city: { contains: q, mode: "insensitive" } },
						],
					}
				: {};

			const [total, publishers] = await Promise.all([
				ctx.db.publisher.count({ where }),
				ctx.db.publisher.findMany({
					where,
					skip: (page - 1) * pageSize,
					take: pageSize,
					orderBy: { name: "asc" },
					include: {
						country: { select: { code: true, name: true } },
						_count: { select: { editions: true } },
					},
				}),
			]);

			return {
				total,
				page,
				pageSize,
				items: publishers.map((p) => ({
					id: p.id,
					name: p.name,
					street: p.street,
					postalCode: p.postalCode,
					city: p.city,
					email: p.email,
					website: p.website,
					country: p.country,
					editionsCount: p._count.editions,
				})),
			};
		}),

	createPublisher: librarianProcedure
		.input(publisherWriteInput)
		.mutation(async ({ ctx, input }) => {
			assertPublisherAddress(input);
			await assertPublisherNameFree(ctx.db, input.name);
			return withDictionaryCheck(() =>
				ctx.db.publisher.create({ data: input, select: { id: true } }),
			);
		}),

	updatePublisher: librarianProcedure
		.input(publisherWriteInput.extend({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			const publisher = await ctx.db.publisher.findUnique({
				where: { id },
				select: { id: true },
			});
			if (!publisher) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono wydawnictwa",
				});
			}
			assertPublisherAddress(data);
			await assertPublisherNameFree(ctx.db, data.name, id);
			await withDictionaryCheck(() =>
				ctx.db.publisher.update({ where: { id }, data }),
			);
			return { ok: true as const };
		}),

	deletePublisher: librarianProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const publisher = await ctx.db.publisher.findUnique({
				where: { id: input.id },
				select: { id: true, _count: { select: { editions: true } } },
			});
			if (!publisher) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono wydawnictwa",
				});
			}
			if (publisher._count.editions > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Wydawnictwo ma ${publisher._count.editions} wydań — nie można go usunąć`,
				});
			}
			await ctx.db.publisher.delete({ where: { id: input.id } });
			return { ok: true as const };
		}),

	listUsers: librarianProcedure
		.input(paginationInput)
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q } = input;
			const skip = (page - 1) * pageSize;
			const now = new Date();

			const where: Prisma.UserWhereInput = q
				? {
						OR: [
							...(userSearchWhere(q).OR ?? []),
							{ phone: { contains: q, mode: "insensitive" } },
							{ pesel: { contains: q } },
							{ street: { contains: q, mode: "insensitive" } },
							{ postalCode: { contains: q } },
							{ city: { contains: q, mode: "insensitive" } },
						],
					}
				: {};

			const [total, users] = await Promise.all([
				ctx.db.user.count({ where }),
				ctx.db.user.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						pesel: true,
						street: true,
						postalCode: true,
						city: true,
						role: true,
						isActive: true,
						createdAt: true,
					},
				}),
			]);

			const ids = users.map((u) => u.id);
			const [active, overdue] = ids.length
				? await Promise.all([
						ctx.db.loan.groupBy({
							by: ["userId"],
							where: { userId: { in: ids }, returnedAt: null },
							_count: { _all: true },
						}),
						ctx.db.loan.groupBy({
							by: ["userId"],
							where: {
								userId: { in: ids },
								returnedAt: null,
								dueAt: { lt: now },
							},
							_count: { _all: true },
						}),
					])
				: [[], []];

			const activeMap = new Map(active.map((r) => [r.userId, r._count._all]));
			const overdueMap = new Map(overdue.map((r) => [r.userId, r._count._all]));

			return {
				total,
				page,
				pageSize,
				currentUserId: ctx.session.user.id,
				items: users.map((u) => ({
					...u,
					activeLoans: activeMap.get(u.id) ?? 0,
					overdueLoans: overdueMap.get(u.id) ?? 0,
				})),
			};
		}),

	setUserActive: librarianProcedure
		.input(z.object({ userId: z.string().min(1), isActive: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			if (input.userId === ctx.session.user.id) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Nie możesz zmienić statusu własnego konta",
				});
			}

			const user = await ctx.db.user.findUnique({
				where: { id: input.userId },
				select: { id: true, role: true },
			});
			if (!user) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono użytkownika",
				});
			}
			if (user.role !== "MEMBER") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Można blokować tylko konta czytelników",
				});
			}

			await ctx.db.user.update({
				where: { id: user.id },
				data: { isActive: input.isActive },
			});
			return { ok: true as const };
		}),

	createMember: librarianProcedure
		.input(
			z.object({
				firstName: z.string().trim().min(1).max(100),
				lastName: z.string().trim().min(1).max(100),
				email: z.string().trim().toLowerCase().email(),
				phone: z
					.string()
					.trim()
					.max(32)
					.optional()
					.transform((value) => (value ? value : undefined)),
				pesel: z.string().transform(normalizePesel),
				...userAddressShape,
				password: z.string().min(8).max(128),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isValidPesel(input.pesel)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "PESEL musi składać się z 11 cyfr",
				});
			}
			assertUserAddress(input);

			const existing = await ctx.db.user.findUnique({
				where: { email: input.email },
				select: { id: true },
			});
			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Konto z tym adresem e-mail już istnieje",
				});
			}

			// Publiczna rejestracja jest wyłączona (disableSignUp), więc konto
			// tworzymy przez wewnętrzny adapter Better Auth — tak jak robi to
			// /sign-up/email. createUser uruchamia databaseHooks (walidacja PESEL).
			const authCtx = await auth.$context;
			const hash = await authCtx.password.hash(input.password);

			let userId: string;
			try {
				const user = await authCtx.internalAdapter.createUser(
					{
						name: `${input.firstName} ${input.lastName}`,
						email: input.email,
						emailVerified: false,
						firstName: input.firstName,
						lastName: input.lastName,
						phone: input.phone,
						pesel: input.pesel,
						street: input.street,
						postalCode: input.postalCode,
						city: input.city,
					},
					{ method: "email-password" },
				);
				userId = user.id;
			} catch (error) {
				if (error instanceof APIError) {
					throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
				}
				if (isUniqueViolation(error)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Konto z tym adresem e-mail lub numerem PESEL już istnieje",
					});
				}
				throw error;
			}

			try {
				await authCtx.internalAdapter.linkAccount({
					userId,
					providerId: "credential",
					accountId: userId,
					password: hash,
				});
			} catch (error) {
				// Bez konta credential użytkownik nie mógłby się zalogować.
				await ctx.db.user.delete({ where: { id: userId } });
				throw error;
			}

			return { ok: true as const, userId };
		}),

	findMemberByEmail: librarianProcedure
		.input(z.object({ email: z.string().trim().email() }))
		.query(async ({ ctx, input }) => {
			const user = await ctx.db.user.findUnique({
				where: { email: input.email },
				select: {
					id: true,
					email: true,
					firstName: true,
					lastName: true,
					isActive: true,
					role: true,
				},
			});
			return user;
		}),
});

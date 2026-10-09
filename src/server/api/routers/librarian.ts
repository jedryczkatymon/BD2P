import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { AuthorName } from "~/lib/library-rules";
import {
	addDays,
	getBorrowBlockReason,
	isUniqueViolation,
	LOAN_DAYS,
	parseAuthorsText,
} from "~/lib/library-rules";
import { createTRPCRouter, librarianProcedure } from "~/server/api/trpc";
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

const bookWriteInput = z.object({
	title: z.string().trim().min(1).max(500),
	ean: z.string().trim().min(1).max(32),
	pageCount: z.number().int().min(1).max(50_000),
	publicationYear: z.number().int().min(1000).max(2100),
	publisherName: z.string().trim().min(1).max(200),
	authors: z.string().trim().min(1).max(1000),
	categoryIds: z.array(z.string().min(1)).max(20),
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

async function resolveBookRelations(
	tx: Prisma.TransactionClient,
	input: { publisherName: string; authors: string },
) {
	const publisherId = await resolvePublisherId(tx, input.publisherName);
	const parsedAuthors = parseAuthorsText(input.authors);
	const authorIds: string[] = [];
	for (const author of parsedAuthors) {
		authorIds.push(await resolveAuthorId(tx, author));
	}
	return { publisherId, authorIds };
}

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
		select: { id: true, status: true, bookId: true, inventoryNo: true },
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

	await db.copy.update({
		where: { id: copy.id },
		data: { status: "LOANED" },
	});

	// Wypożyczenie zarezerwowanej książki realizuje rezerwację czytelnika.
	await db.reservation.updateMany({
		where: {
			userId: params.userId,
			bookId: copy.bookId,
			status: "PENDING",
		},
		data: { status: "FULFILLED" },
	});

	return {
		loanId: loan.id,
		bookId: copy.bookId,
		inventoryNo: copy.inventoryNo,
	};
}

const categoryNameSchema = z.string().trim().min(1).max(100);

async function assertCategoryNameFree(
	db: Prisma.TransactionClient | typeof import("~/server/db").db,
	name: string,
	exceptId?: string,
) {
	const existing = await db.category.findFirst({
		where: {
			name: { equals: name, mode: "insensitive" },
			...(exceptId ? { NOT: { id: exceptId } } : {}),
		},
		select: { id: true },
	});
	if (existing) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Kategoria o tej nazwie już istnieje",
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
					{ copy: { book: { title: { contains: q, mode: "insensitive" } } } },
					{ copy: { book: { ean: { contains: q, mode: "insensitive" } } } },
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
								book: {
									select: { id: true, title: true, ean: true },
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
					book: loan.copy.book,
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
					{ book: { title: { contains: q, mode: "insensitive" } } },
					{ book: { ean: { contains: q, mode: "insensitive" } } },
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
						book: {
							select: { id: true, title: true, ean: true },
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
					book: r.book,
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
					{ copy: { book: { title: { contains: q, mode: "insensitive" } } } },
					{ copy: { book: { ean: { contains: q, mode: "insensitive" } } } },
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
								book: {
									select: { id: true, title: true, ean: true },
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
							book: loan.copy.book,
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
					{ book: { title: { contains: q, mode: "insensitive" } } },
					{ book: { ean: { contains: q, mode: "insensitive" } } },
					{ user: userSearchWhere(q) },
				];
			}

			const [total, reservations] = await Promise.all([
				ctx.db.reservation.count({ where }),
				ctx.db.reservation.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { updatedAt: "desc" },
					include: {
						user: {
							select: {
								id: true,
								email: true,
								firstName: true,
								lastName: true,
							},
						},
						book: {
							select: { id: true, title: true, ean: true },
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
					updatedAt: r.updatedAt,
					user: r.user,
					book: r.book,
				})),
			};
		}),

	listBooks: librarianProcedure
		.input(
			paginationInput.extend({
				authorId: z.string().trim().optional(),
				publisherId: z.string().trim().optional(),
				categoryId: z.string().trim().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { page, pageSize, q } = input;
			const skip = (page - 1) * pageSize;
			const and: Prisma.BookWhereInput[] = [];

			if (q) {
				and.push({
					OR: [
						{ title: { contains: q, mode: "insensitive" } },
						{ ean: { contains: q, mode: "insensitive" } },
						{
							publisher: {
								name: { contains: q, mode: "insensitive" },
							},
						},
					],
				});
			}

			if (input.authorId) {
				and.push({ authors: { some: { authorId: input.authorId } } });
			}
			if (input.publisherId) {
				and.push({ publisherId: input.publisherId });
			}
			if (input.categoryId) {
				and.push({
					categories: { some: { categoryId: input.categoryId } },
				});
			}

			const where: Prisma.BookWhereInput = and.length > 0 ? { AND: and } : {};

			const [total, books] = await Promise.all([
				ctx.db.book.count({ where }),
				ctx.db.book.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { title: "asc" },
					include: {
						publisher: { select: { id: true, name: true } },
						authors: {
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
						},
						_count: { select: { copies: true } },
					},
				}),
			]);

			return {
				total,
				page,
				pageSize,
				items: books.map((book) => ({
					id: book.id,
					title: book.title,
					ean: book.ean,
					pageCount: book.pageCount,
					publicationYear: book.publicationYear,
					publisher: book.publisher,
					authors: book.authors.map((ba) => ba.author),
					copiesCount: book._count.copies,
				})),
			};
		}),

	getBookWithCopies: librarianProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const book = await ctx.db.book.findUnique({
				where: { id: input.id },
				include: {
					publisher: { select: { id: true, name: true } },
					authors: {
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
					},
					categories: {
						include: {
							category: { select: { id: true, name: true } },
						},
					},
					copies: {
						orderBy: { inventoryNo: "asc" },
						select: {
							id: true,
							inventoryNo: true,
							status: true,
						},
					},
				},
			});

			if (!book) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono książki",
				});
			}

			return {
				id: book.id,
				title: book.title,
				ean: book.ean,
				pageCount: book.pageCount,
				publicationYear: book.publicationYear,
				publisher: book.publisher,
				authors: book.authors.map((ba) => ba.author),
				categories: book.categories.map((bc) => bc.category),
				copies: book.copies,
			};
		}),

	returnLoan: librarianProcedure
		.input(z.object({ loanId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.$transaction(async (tx) => {
				const loan = await tx.loan.findUnique({
					where: { id: input.loanId },
					select: {
						id: true,
						returnedAt: true,
						copyId: true,
						copy: { select: { status: true } },
					},
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

				await tx.loan.update({
					where: { id: loan.id },
					data: { returnedAt: new Date() },
				});

				if (loan.copy.status !== "LOST" && loan.copy.status !== "MAINTENANCE") {
					await tx.copy.update({
						where: { id: loan.copyId },
						data: { status: "AVAILABLE" },
					});
				}
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
				data: { status: "CANCELLED" },
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
						bookId: true,
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
						bookId: reservation.bookId,
						status: "AVAILABLE",
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

	createBook: librarianProcedure
		.input(bookWriteInput)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.book.findUnique({
				where: { ean: input.ean },
				select: { id: true },
			});
			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Książka o tym EAN już istnieje",
				});
			}

			return ctx.db.$transaction(async (tx) => {
				const { publisherId, authorIds } = await resolveBookRelations(tx, {
					publisherName: input.publisherName,
					authors: input.authors,
				});

				return tx.book.create({
					data: {
						title: input.title,
						ean: input.ean,
						pageCount: input.pageCount,
						publicationYear: input.publicationYear,
						publisherId,
						authors: {
							create: authorIds.map((authorId, index) => ({
								authorId,
								authorOrder: index + 1,
							})),
						},
						categories: {
							create: input.categoryIds.map((categoryId) => ({
								categoryId,
							})),
						},
					},
					select: { id: true },
				});
			});
		}),

	updateBook: librarianProcedure
		.input(bookWriteInput.extend({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const conflict = await ctx.db.book.findFirst({
				where: {
					ean: input.ean,
					NOT: { id: input.id },
				},
				select: { id: true },
			});
			if (conflict) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Inna książka ma już ten EAN",
				});
			}

			await ctx.db.$transaction(async (tx) => {
				const book = await tx.book.findUnique({
					where: { id: input.id },
					select: { id: true },
				});
				if (!book) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Nie znaleziono książki",
					});
				}

				const { publisherId, authorIds } = await resolveBookRelations(tx, {
					publisherName: input.publisherName,
					authors: input.authors,
				});

				await tx.bookAuthor.deleteMany({ where: { bookId: input.id } });
				await tx.bookCategory.deleteMany({ where: { bookId: input.id } });

				await tx.book.update({
					where: { id: input.id },
					data: {
						title: input.title,
						ean: input.ean,
						pageCount: input.pageCount,
						publicationYear: input.publicationYear,
						publisherId,
						authors: {
							create: authorIds.map((authorId, index) => ({
								authorId,
								authorOrder: index + 1,
							})),
						},
						categories: {
							create: input.categoryIds.map((categoryId) => ({
								categoryId,
							})),
						},
					},
				});
			});

			return { ok: true as const };
		}),

	addCopy: librarianProcedure
		.input(
			z.object({
				bookId: z.string().min(1),
				inventoryNo: z.string().trim().min(1).max(64),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const book = await ctx.db.book.findUnique({
				where: { id: input.bookId },
				select: { id: true },
			});
			if (!book) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono książki",
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
					bookId: input.bookId,
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

			if (copy.status === "LOANED" || copy.loans.length > 0) {
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

	deleteBook: librarianProcedure
		.input(z.object({ bookId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const book = await ctx.db.book.findUnique({
				where: { id: input.bookId },
				select: {
					id: true,
					_count: { select: { copies: true } },
				},
			});

			if (!book) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono książki",
				});
			}

			if (book._count.copies > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Najpierw usuń wszystkie egzemplarze tej książki",
				});
			}

			const pending = await ctx.db.reservation.count({
				where: { bookId: book.id, status: "PENDING" },
			});
			if (pending > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Książka ma aktywne rezerwacje — najpierw je anuluj",
				});
			}

			await ctx.db.book.delete({ where: { id: book.id } });
			return { ok: true as const };
		}),

	listCategories: librarianProcedure.query(async ({ ctx }) => {
		const categories = await ctx.db.category.findMany({
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				_count: { select: { books: true } },
			},
		});
		return categories.map((c) => ({
			id: c.id,
			name: c.name,
			booksCount: c._count.books,
		}));
	}),

	createCategory: librarianProcedure
		.input(z.object({ name: categoryNameSchema }))
		.mutation(async ({ ctx, input }) => {
			await assertCategoryNameFree(ctx.db, input.name);
			return ctx.db.category.create({
				data: { name: input.name },
				select: { id: true, name: true },
			});
		}),

	renameCategory: librarianProcedure
		.input(z.object({ id: z.string().min(1), name: categoryNameSchema }))
		.mutation(async ({ ctx, input }) => {
			const category = await ctx.db.category.findUnique({
				where: { id: input.id },
				select: { id: true },
			});
			if (!category) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono kategorii",
				});
			}
			await assertCategoryNameFree(ctx.db, input.name, input.id);
			await ctx.db.category.update({
				where: { id: input.id },
				data: { name: input.name },
			});
			return { ok: true as const };
		}),

	deleteCategory: librarianProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const category = await ctx.db.category.findUnique({
				where: { id: input.id },
				select: { id: true, _count: { select: { books: true } } },
			});
			if (!category) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono kategorii",
				});
			}
			if (category._count.books > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Kategoria jest przypisana do ${category._count.books} książek — nie można jej usunąć`,
				});
			}
			await ctx.db.category.delete({ where: { id: input.id } });
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

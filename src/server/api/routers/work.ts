import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	COPY_AVAILABILITY_SELECT,
	isCopyLoanable,
	isCopyOnLoan,
	LOANABLE_COPY_WHERE,
} from "~/lib/library-rules";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";
import type { Prisma } from "../../../../generated/prisma/client";

const pageSizeSchema = z.union([z.literal(50), z.literal(100), z.literal(200)]);

const optionalId = z
	.string()
	.trim()
	.optional()
	.transform((value) => (value ? value : undefined));

const authorSelect = {
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

const authorDetailsSelect = {
	orderBy: { authorOrder: "asc" },
	include: {
		author: {
			select: {
				id: true,
				firstName: true,
				lastName: true,
				birthYear: true,
				country: { select: { code: true, name: true } },
			},
		},
	},
} satisfies Prisma.Work$authorsArgs;

const languageSelect = { select: { code: true, name: true } } as const;

function buildWorkWhere(input: {
	q?: string;
	authorId?: string;
	publisherId?: string;
	genreId?: string;
	languageCode?: string;
	authorCountryCode?: string;
	availableOnly?: boolean;
}): Prisma.WorkWhereInput {
	const where: Prisma.WorkWhereInput = {};
	const and: Prisma.WorkWhereInput[] = [];

	const q = input.q?.trim();
	if (q) {
		const editionOr: Prisma.EditionWhereInput[] = [
			{ ean: { contains: q, mode: "insensitive" } },
			{
				publisher: {
					name: { contains: q, mode: "insensitive" },
				},
			},
		];
		const or: Prisma.WorkWhereInput[] = [
			{ title: { contains: q, mode: "insensitive" } },
			{ originalTitle: { contains: q, mode: "insensitive" } },
			{
				authors: {
					some: {
						author: {
							OR: [
								{ firstName: { contains: q, mode: "insensitive" } },
								{ lastName: { contains: q, mode: "insensitive" } },
							],
						},
					},
				},
			},
			{
				genres: {
					some: {
						genre: {
							name: { contains: q, mode: "insensitive" },
						},
					},
				},
			},
		];

		const year = Number(q);
		if (Number.isInteger(year) && year > 0) {
			or.push({ originalYear: year });
			editionOr.push({ publicationYear: year });
		}

		or.push({ editions: { some: { OR: editionOr } } });
		and.push({ OR: or });
	}

	if (input.authorId) {
		and.push({
			authors: { some: { authorId: input.authorId } },
		});
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

	if (input.languageCode) {
		and.push({
			editions: { some: { languageCode: input.languageCode } },
		});
	}

	if (input.authorCountryCode) {
		and.push({
			authors: {
				some: { author: { countryCode: input.authorCountryCode } },
			},
		});
	}

	if (input.availableOnly) {
		and.push({
			editions: { some: { copies: { some: LOANABLE_COPY_WHERE } } },
		});
	}

	if (and.length > 0) {
		where.AND = and;
	}

	return where;
}

function summarizeCopies(copies: { status: string; loans: unknown[] }[]) {
	let available = 0;
	let loaned = 0;
	let other = 0;
	for (const copy of copies) {
		if (isCopyOnLoan(copy)) loaned += 1;
		else if (isCopyLoanable(copy)) available += 1;
		else other += 1;
	}
	return { available, loaned, other, total: copies.length };
}

export const workRouter = createTRPCRouter({
	filterOptions: publicProcedure.query(async ({ ctx }) => {
		const [authors, publishers, genres, countries, languages] =
			await Promise.all([
				ctx.db.author.findMany({
					select: { id: true, firstName: true, lastName: true },
					orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
				}),
				ctx.db.publisher.findMany({
					select: { id: true, name: true },
					orderBy: { name: "asc" },
				}),
				ctx.db.genre.findMany({
					select: { id: true, name: true },
					orderBy: { name: "asc" },
				}),
				ctx.db.country.findMany({
					select: { code: true, name: true },
					orderBy: { name: "asc" },
				}),
				ctx.db.language.findMany({
					select: { code: true, name: true },
					orderBy: { name: "asc" },
				}),
			]);

		return { authors, publishers, genres, countries, languages };
	}),

	list: publicProcedure
		.input(
			z.object({
				page: z.number().int().min(1).default(1),
				pageSize: pageSizeSchema.default(50),
				q: z.string().trim().max(200).optional(),
				authorId: optionalId,
				publisherId: optionalId,
				genreId: optionalId,
				languageCode: optionalId,
				authorCountryCode: optionalId,
				availableOnly: z.boolean().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { page, pageSize } = input;
			const skip = (page - 1) * pageSize;
			const where = buildWorkWhere(input);

			const [total, works] = await Promise.all([
				ctx.db.work.count({ where }),
				ctx.db.work.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { title: "asc" },
					include: {
						authors: authorSelect,
						editions: {
							select: { copies: { select: COPY_AVAILABILITY_SELECT } },
						},
					},
				}),
			]);

			const items = works.map((work) => {
				const copies = work.editions.flatMap((e) => e.copies);
				return {
					id: work.id,
					title: work.title,
					originalTitle: work.originalTitle,
					originalYear: work.originalYear,
					authors: work.authors.map((wa) => wa.author),
					editionsCount: work.editions.length,
					availableCount: copies.filter(isCopyLoanable).length,
					totalCopies: copies.length,
				};
			});

			return { items, total, page, pageSize };
		}),

	byId: publicProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const work = await ctx.db.work.findUnique({
				where: { id: input.id },
				include: {
					authors: authorDetailsSelect,
					originalLanguage: languageSelect,
					genres: {
						include: {
							genre: { select: { id: true, name: true } },
						},
					},
					editions: {
						orderBy: [{ publicationYear: "desc" }, { ean: "asc" }],
						include: {
							publisher: {
								select: {
									id: true,
									name: true,
									city: true,
									website: true,
									country: { select: { code: true, name: true } },
								},
							},
							language: languageSelect,
							copies: { select: COPY_AVAILABILITY_SELECT },
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
					copiesSummary: summarizeCopies(edition.copies),
				})),
				copiesSummary: summarizeCopies(work.editions.flatMap((e) => e.copies)),
			};
		}),

	myReservation: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const reservation = await ctx.db.reservation.findFirst({
				where: {
					workId: input.workId,
					userId: ctx.session.user.id,
					status: "PENDING",
				},
				select: { id: true },
			});
			return reservation;
		}),

	reserve: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const user = await ctx.db.user.findUniqueOrThrow({
				where: { id: userId },
				select: { isActive: true },
			});

			if (!user.isActive) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Konto jest nieaktywne — nie możesz rezerwować książek",
				});
			}

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

			const availableCount = await ctx.db.copy.count({
				where: { edition: { workId: input.workId }, ...LOANABLE_COPY_WHERE },
			});

			if (availableCount > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Rezerwacja możliwa tylko, gdy brak dostępnych egzemplarzy",
				});
			}

			const existing = await ctx.db.reservation.findFirst({
				where: {
					workId: input.workId,
					userId,
					status: "PENDING",
				},
				select: { id: true },
			});

			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Masz już aktywną rezerwację tej pozycji",
				});
			}

			const reservation = await ctx.db.reservation.create({
				data: {
					workId: input.workId,
					userId,
					status: "PENDING",
				},
				select: { id: true },
			});

			return reservation;
		}),

	cancelReservation: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const reservation = await ctx.db.reservation.findFirst({
				where: {
					workId: input.workId,
					userId: ctx.session.user.id,
					status: "PENDING",
				},
				select: { id: true },
			});

			if (!reservation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono aktywnej rezerwacji",
				});
			}

			await ctx.db.reservation.update({
				where: { id: reservation.id },
				data: { status: "CANCELLED", closedAt: new Date() },
			});

			return { ok: true as const };
		}),
});

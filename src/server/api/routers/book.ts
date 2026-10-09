import { TRPCError } from "@trpc/server";
import { z } from "zod";
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

function buildBookWhere(input: {
	q?: string;
	authorId?: string;
	publisherId?: string;
	categoryId?: string;
	availableOnly?: boolean;
}): Prisma.BookWhereInput {
	const where: Prisma.BookWhereInput = {};
	const and: Prisma.BookWhereInput[] = [];

	const q = input.q?.trim();
	if (q) {
		const or: Prisma.BookWhereInput[] = [
			{ title: { contains: q, mode: "insensitive" } },
			{ ean: { contains: q, mode: "insensitive" } },
			{
				publisher: {
					name: { contains: q, mode: "insensitive" },
				},
			},
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
				categories: {
					some: {
						category: {
							name: { contains: q, mode: "insensitive" },
						},
					},
				},
			},
		];

		const year = Number(q);
		if (Number.isInteger(year) && year > 0) {
			or.push({ publicationYear: year });
		}

		and.push({ OR: or });
	}

	if (input.authorId) {
		and.push({
			authors: { some: { authorId: input.authorId } },
		});
	}

	if (input.publisherId) {
		where.publisherId = input.publisherId;
	}

	if (input.categoryId) {
		and.push({
			categories: { some: { categoryId: input.categoryId } },
		});
	}

	if (input.availableOnly) {
		and.push({
			copies: { some: { status: "AVAILABLE" } },
		});
	}

	if (and.length > 0) {
		where.AND = and;
	}

	return where;
}

export const bookRouter = createTRPCRouter({
	filterOptions: publicProcedure.query(async ({ ctx }) => {
		const [authors, publishers, categories] = await Promise.all([
			ctx.db.author.findMany({
				select: { id: true, firstName: true, lastName: true },
				orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
			}),
			ctx.db.publisher.findMany({
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			}),
			ctx.db.category.findMany({
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			}),
		]);

		return { authors, publishers, categories };
	}),

	list: publicProcedure
		.input(
			z.object({
				page: z.number().int().min(1).default(1),
				pageSize: pageSizeSchema.default(50),
				q: z.string().trim().max(200).optional(),
				authorId: optionalId,
				publisherId: optionalId,
				categoryId: optionalId,
				availableOnly: z.boolean().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { page, pageSize } = input;
			const skip = (page - 1) * pageSize;
			const where = buildBookWhere(input);

			const [total, books] = await Promise.all([
				ctx.db.book.count({ where }),
				ctx.db.book.findMany({
					where,
					skip,
					take: pageSize,
					orderBy: { title: "asc" },
					include: {
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
						copies: {
							select: { status: true },
						},
					},
				}),
			]);

			const items = books.map((book) => {
				const availableCount = book.copies.filter(
					(c) => c.status === "AVAILABLE",
				).length;
				return {
					id: book.id,
					title: book.title,
					ean: book.ean,
					publicationYear: book.publicationYear,
					pageCount: book.pageCount,
					authors: book.authors.map((ba) => ba.author),
					availableCount,
					totalCopies: book.copies.length,
				};
			});

			return { items, total, page, pageSize };
		}),

	byId: publicProcedure
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
						select: { status: true },
					},
				},
			});

			if (!book) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Nie znaleziono książki",
				});
			}

			let available = 0;
			let loaned = 0;
			let other = 0;
			for (const copy of book.copies) {
				if (copy.status === "AVAILABLE") available += 1;
				else if (copy.status === "LOANED") loaned += 1;
				else other += 1;
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
				copiesSummary: {
					available,
					loaned,
					other,
					total: book.copies.length,
				},
			};
		}),

	myReservation: protectedProcedure
		.input(z.object({ bookId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const reservation = await ctx.db.reservation.findFirst({
				where: {
					bookId: input.bookId,
					userId: ctx.session.user.id,
					status: "PENDING",
				},
				select: { id: true },
			});
			return reservation;
		}),

	reserve: protectedProcedure
		.input(z.object({ bookId: z.string().min(1) }))
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

			const availableCount = await ctx.db.copy.count({
				where: { bookId: input.bookId, status: "AVAILABLE" },
			});

			if (availableCount > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Rezerwacja możliwa tylko, gdy brak dostępnych egzemplarzy",
				});
			}

			const existing = await ctx.db.reservation.findFirst({
				where: {
					bookId: input.bookId,
					userId,
					status: "PENDING",
				},
				select: { id: true },
			});

			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Masz już aktywną rezerwację tej książki",
				});
			}

			const reservation = await ctx.db.reservation.create({
				data: {
					bookId: input.bookId,
					userId,
					status: "PENDING",
				},
				select: { id: true },
			});

			return reservation;
		}),

	cancelReservation: protectedProcedure
		.input(z.object({ bookId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const reservation = await ctx.db.reservation.findFirst({
				where: {
					bookId: input.bookId,
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
				data: { status: "CANCELLED" },
			});

			return { ok: true as const };
		}),
});

import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const requiredNamePart = z.string().trim().min(1).max(100);
const optionalPhone = z
	.string()
	.trim()
	.optional()
	.transform((value) => (value ? value : null));

const profileSelect = {
	id: true,
	email: true,
	firstName: true,
	lastName: true,
	phone: true,
	pesel: true,
	role: true,
	isActive: true,
	createdAt: true,
} as const;

const loanInclude = {
	copy: {
		select: {
			id: true,
			inventoryNo: true,
			book: {
				select: {
					id: true,
					title: true,
				},
			},
		},
	},
} as const;

function mapLoan<
	T extends {
		id: string;
		loanedAt: Date;
		dueAt: Date;
		returnedAt: Date | null;
		copy: {
			inventoryNo: string;
			book: { id: string; title: string };
		};
	},
>(loan: T) {
	return {
		id: loan.id,
		loanedAt: loan.loanedAt,
		dueAt: loan.dueAt,
		returnedAt: loan.returnedAt,
		inventoryNo: loan.copy.inventoryNo,
		book: loan.copy.book,
	};
}

function derivedDisplayName(firstName: string, lastName: string) {
	return `${firstName} ${lastName}`.trim();
}

export const userRouter = createTRPCRouter({
	me: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const user = await ctx.db.user.findUniqueOrThrow({
			where: { id: userId },
			select: profileSelect,
		});

		const [loans, loanHistory, reservations] = await Promise.all([
			ctx.db.loan.findMany({
				where: { userId, returnedAt: null },
				orderBy: { dueAt: "asc" },
				include: loanInclude,
			}),
			ctx.db.loan.findMany({
				where: { userId, returnedAt: { not: null } },
				orderBy: { returnedAt: "desc" },
				take: 50,
				include: loanInclude,
			}),
			ctx.db.reservation.findMany({
				where: { userId, status: "PENDING" },
				orderBy: { createdAt: "asc" },
				include: {
					book: {
						select: {
							id: true,
							title: true,
						},
					},
				},
			}),
		]);

		return {
			user,
			loans: loans.map(mapLoan),
			loanHistory: loanHistory.map(mapLoan),
			reservations: reservations.map((r) => ({
				id: r.id,
				createdAt: r.createdAt,
				book: r.book,
			})),
		};
	}),

	updateProfile: protectedProcedure
		.input(
			z.object({
				firstName: requiredNamePart,
				lastName: requiredNamePart,
				phone: optionalPhone,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const user = await ctx.db.user.update({
				where: { id: ctx.session.user.id },
				data: {
					firstName: input.firstName,
					lastName: input.lastName,
					phone: input.phone,
					name: derivedDisplayName(input.firstName, input.lastName),
				},
				select: profileSelect,
			});
			return user;
		}),
});

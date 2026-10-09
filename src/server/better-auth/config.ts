import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";

import { isValidPesel, normalizePesel } from "~/lib/pesel";
import { db } from "~/server/db";

export const auth = betterAuth({
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
	},
	user: {
		additionalFields: {
			firstName: { type: "string", required: true },
			lastName: { type: "string", required: true },
			phone: { type: "string", required: false },
			pesel: { type: "string", required: true },
			role: {
				type: "string",
				required: false,
				defaultValue: "MEMBER",
				input: false,
			},
			isActive: {
				type: "boolean",
				required: false,
				defaultValue: true,
				input: false,
			},
		},
	},
	databaseHooks: {
		user: {
			create: {
				// PESEL jest wymagany przy rejestracji, ma 11 cyfr i jest unikalny.
				before: async (user) => {
					const pesel = normalizePesel(String(user.pesel ?? ""));

					if (!isValidPesel(pesel)) {
						throw new APIError("BAD_REQUEST", {
							message: "PESEL musi składać się z 11 cyfr",
						});
					}

					const existing = await db.user.findUnique({
						where: { pesel },
						select: { id: true },
					});
					if (existing) {
						throw new APIError("BAD_REQUEST", {
							message: "Konto z tym numerem PESEL już istnieje",
						});
					}

					return { data: { ...user, pesel } };
				},
			},
			update: {
				// PESEL nie może być zmieniany po rejestracji.
				before: async (data) => {
					if ("pesel" in data) {
						throw new APIError("BAD_REQUEST", {
							message: "PESEL nie może być zmieniany",
						});
					}
					return { data };
				},
			},
		},
	},
});

export type Session = typeof auth.$Infer.Session;

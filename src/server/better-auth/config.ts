import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

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
			firstName: { type: "string", required: false },
			lastName: { type: "string", required: false },
			phone: { type: "string", required: false },
			pesel: { type: "string", required: false },
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
});

export type Session = typeof auth.$Infer.Session;

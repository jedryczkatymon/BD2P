import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isValidPolishPostalCode, normalizePostalCode } from "~/lib/address";

/** Required user address fields, spread into a `z.object`. */
export const userAddressShape = {
	street: z.string().trim().min(1).max(200),
	postalCode: z.string().transform(normalizePostalCode),
	city: z.string().trim().min(1).max(100),
};

/** Optional publisher address fields (empty string -> NULL). */
export const publisherAddressShape = {
	street: z
		.string()
		.trim()
		.max(200)
		.nullable()
		.transform((value) => (value ? value : null)),
	postalCode: z
		.string()
		.max(20)
		.nullable()
		.transform((value) => (value ? normalizePostalCode(value) || null : null)),
	city: z
		.string()
		.trim()
		.max(100)
		.nullable()
		.transform((value) => (value ? value : null)),
};

const POSTAL_CODE_MESSAGE = "Kod pocztowy musi mieć format 00-000";

/** Mirrors the `user_postal_code_format` CHECK with a readable message. */
export function assertUserAddress(address: { postalCode: string }) {
	if (!isValidPolishPostalCode(address.postalCode)) {
		throw new TRPCError({ code: "BAD_REQUEST", message: POSTAL_CODE_MESSAGE });
	}
}

/** Mirrors the publisher address CHECKs with readable messages. */
export function assertPublisherAddress(address: {
	countryCode: string | null;
	street: string | null;
	postalCode: string | null;
	city: string | null;
}) {
	if ((address.street || address.postalCode) && !address.city) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Podaj miasto — ulica i kod pocztowy wymagają miasta",
		});
	}
	if (
		address.postalCode &&
		address.countryCode === "PL" &&
		!isValidPolishPostalCode(address.postalCode)
	) {
		throw new TRPCError({ code: "BAD_REQUEST", message: POSTAL_CODE_MESSAGE });
	}
}

import { TRPCError } from "@trpc/server";

import { MAX_ACTIVE_LOANS } from "~/lib/loan-limits";

/** Termin zwrotu liczony od dnia wypożyczenia. */
export const LOAN_DAYS = 14;

export type AuthorName = { firstName: string; lastName: string };

export function addDays(from: Date, days: number) {
	const d = new Date(from);
	d.setDate(d.getDate() + days);
	return d;
}

/** Parse "Nazwisko Imię, …" — last token is firstName, the rest is lastName. */
export function parseAuthorsText(text: string): AuthorName[] {
	const parts = text
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);

	if (parts.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Podaj co najmniej jednego autora (Nazwisko Imię)",
		});
	}
	if (parts.length > 20) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Maksymalnie 20 autorów",
		});
	}

	return parts.map((part) => {
		const tokens = part.split(/\s+/).filter(Boolean);
		if (tokens.length < 2) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Nieprawidłowy autor „${part}” — użyj formatu Nazwisko Imię`,
			});
		}
		const firstName = tokens.at(-1);
		if (!firstName) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Nieprawidłowy autor „${part}” — użyj formatu Nazwisko Imię`,
			});
		}
		const lastName = tokens.slice(0, -1).join(" ");
		return { firstName, lastName };
	});
}

/** Rozpoznaje naruszenie unikalności (Prisma P2002 / Postgres 23505). */
export function isUniqueViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const { code, message } = error as { code?: unknown; message?: unknown };
	return (
		code === "P2002" ||
		code === "23505" ||
		(typeof message === "string" &&
			message.includes("loan_one_active_per_copy"))
	);
}

export type BorrowBlock = {
	code: "FORBIDDEN" | "BAD_REQUEST";
	message: string;
};

/**
 * Sprawdza, czy czytelnik może wypożyczyć kolejny egzemplarz.
 * Zwraca powód odmowy albo `null`, gdy wypożyczenie jest dozwolone.
 */
export function getBorrowBlockReason(state: {
	isActive: boolean;
	activeCount: number;
	overdueCount: number;
}): BorrowBlock | null {
	if (!state.isActive) {
		return { code: "FORBIDDEN", message: "Konto czytelnika jest nieaktywne" };
	}
	if (state.overdueCount > 0) {
		return {
			code: "BAD_REQUEST",
			message: "Czytelnik ma przeterminowane wypożyczenia",
		};
	}
	if (state.activeCount >= MAX_ACTIVE_LOANS) {
		return {
			code: "BAD_REQUEST",
			message: `Limit aktywnych wypożyczeń (${MAX_ACTIVE_LOANS}) został wyczerpany`,
		};
	}
	return null;
}

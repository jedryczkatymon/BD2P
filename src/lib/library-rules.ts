import { TRPCError } from "@trpc/server";

import { MAX_ACTIVE_LOANS } from "~/lib/loan-limits";
import type { Prisma } from "../../generated/prisma/client";

/** Termin zwrotu liczony od dnia wypożyczenia. */
export const LOAN_DAYS = 14;

/**
 * Egzemplarz można wypożyczyć, gdy jest sprawny (AVAILABLE) i nie ma aktywnego
 * wypożyczenia. Wypożyczenie nie jest zapisywane w Copy.status — wynika z Loan.
 */
export const LOANABLE_COPY_WHERE = {
	status: "AVAILABLE",
	loans: { none: { returnedAt: null } },
} satisfies Prisma.CopyWhereInput;

/** Select potrzebny do ustalenia dostępności egzemplarza (patrz isCopyLoanable). */
export const COPY_AVAILABILITY_SELECT = {
	status: true,
	loans: { where: { returnedAt: null }, select: { id: true }, take: 1 },
} satisfies Prisma.CopySelect;

export function isCopyOnLoan(copy: { loans: unknown[] }) {
	return copy.loans.length > 0;
}

export function isCopyLoanable(copy: { status: string; loans: unknown[] }) {
	return copy.status === "AVAILABLE" && !isCopyOnLoan(copy);
}

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

/** Insert/update referencing a missing row, e.g. an unknown country or language code. */
export function isForeignKeyViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const { code } = error as { code?: unknown };
	return code === "P2003" || code === "23503";
}

export const BOOK_FORMAT_LABELS = {
	HARDCOVER: "twarda",
	PAPERBACK: "miękka",
} as const;

export type BookFormatValue = keyof typeof BOOK_FORMAT_LABELS;

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

import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import {
	addDays,
	getBorrowBlockReason,
	isUniqueViolation,
	LOAN_DAYS,
	parseAuthorsText,
} from "~/lib/library-rules";
import { MAX_ACTIVE_LOANS } from "~/lib/loan-limits";

describe("stałe reguł", () => {
	it("termin wypożyczenia to 14 dni, a limit aktywnych to 5", () => {
		expect(LOAN_DAYS).toBe(14);
		expect(MAX_ACTIVE_LOANS).toBe(5);
	});
});

describe("addDays", () => {
	it("dodaje podaną liczbę dni", () => {
		const from = new Date(2026, 0, 10, 12, 0, 0);
		const result = addDays(from, LOAN_DAYS);
		expect(result.getFullYear()).toBe(2026);
		expect(result.getMonth()).toBe(0);
		expect(result.getDate()).toBe(24);
	});

	it("przechodzi przez granicę miesiąca", () => {
		const result = addDays(new Date(2026, 0, 25, 12), 14);
		expect(result.getMonth()).toBe(1);
		expect(result.getDate()).toBe(8);
	});

	it("nie modyfikuje daty wejściowej", () => {
		const from = new Date(2026, 5, 1, 12);
		const before = from.getTime();
		addDays(from, 14);
		expect(from.getTime()).toBe(before);
	});
});

describe("parseAuthorsText", () => {
	it("dzieli autorów po przecinku w formacie Nazwisko Imię", () => {
		expect(parseAuthorsText("Nowak Jan, Kowalska-Nowak Anna")).toEqual([
			{ lastName: "Nowak", firstName: "Jan" },
			{ lastName: "Kowalska-Nowak", firstName: "Anna" },
		]);
	});

	it("traktuje ostatni człon jako imię, a resztę jako nazwisko", () => {
		expect(parseAuthorsText("von Neumann Jan")).toEqual([
			{ lastName: "von Neumann", firstName: "Jan" },
		]);
	});

	it("ignoruje puste fragmenty i nadmiarowe spacje", () => {
		expect(parseAuthorsText("  Nowak   Jan ,, ")).toEqual([
			{ lastName: "Nowak", firstName: "Jan" },
		]);
	});

	it("rzuca BAD_REQUEST dla pustego tekstu", () => {
		expect(() => parseAuthorsText("  , ")).toThrow(TRPCError);
		try {
			parseAuthorsText("");
		} catch (error) {
			expect((error as TRPCError).code).toBe("BAD_REQUEST");
		}
	});

	it("rzuca błąd dla autora bez imienia lub nazwiska", () => {
		expect(() => parseAuthorsText("Nowak")).toThrow(/Nazwisko Imię/);
	});

	it("dopuszcza 20 autorów i odrzuca 21", () => {
		const make = (n: number) =>
			Array.from({ length: n }, (_, i) => `Autor${i} Jan`).join(", ");
		expect(parseAuthorsText(make(20))).toHaveLength(20);
		expect(() => parseAuthorsText(make(21))).toThrow(/Maksymalnie 20/);
	});
});

describe("getBorrowBlockReason", () => {
	const ok = { isActive: true, activeCount: 0, overdueCount: 0 };

	it("pozwala wypożyczać aktywnemu czytelnikowi w limicie", () => {
		expect(getBorrowBlockReason(ok)).toBeNull();
		expect(getBorrowBlockReason({ ...ok, activeCount: 4 })).toBeNull();
	});

	it("blokuje nieaktywne konto", () => {
		expect(getBorrowBlockReason({ ...ok, isActive: false })).toEqual({
			code: "FORBIDDEN",
			message: "Konto czytelnika jest nieaktywne",
		});
	});

	it("blokuje przy przeterminowanych wypożyczeniach", () => {
		const block = getBorrowBlockReason({ ...ok, overdueCount: 1 });
		expect(block?.code).toBe("BAD_REQUEST");
		expect(block?.message).toMatch(/przeterminowane/);
	});

	it("blokuje po osiągnięciu limitu 5 aktywnych wypożyczeń", () => {
		const block = getBorrowBlockReason({ ...ok, activeCount: 5 });
		expect(block?.code).toBe("BAD_REQUEST");
		expect(block?.message).toMatch(/Limit aktywnych wypożyczeń \(5\)/);
	});

	it("nieaktywne konto ma pierwszeństwo przed pozostałymi powodami", () => {
		const block = getBorrowBlockReason({
			isActive: false,
			activeCount: 9,
			overdueCount: 3,
		});
		expect(block?.code).toBe("FORBIDDEN");
	});
});

describe("isUniqueViolation", () => {
	it("rozpoznaje kod Prisma P2002 i Postgres 23505", () => {
		expect(isUniqueViolation({ code: "P2002" })).toBe(true);
		expect(isUniqueViolation({ code: "23505" })).toBe(true);
	});

	it("rozpoznaje komunikat z nazwą indeksu", () => {
		expect(
			isUniqueViolation(
				new Error('duplicate key value violates "loan_one_active_per_copy"'),
			),
		).toBe(true);
	});

	it("nie myli innych błędów", () => {
		expect(isUniqueViolation(new Error("coś innego"))).toBe(false);
		expect(isUniqueViolation({ code: "P2025" })).toBe(false);
		expect(isUniqueViolation(null)).toBe(false);
		expect(isUniqueViolation("P2002")).toBe(false);
	});
});

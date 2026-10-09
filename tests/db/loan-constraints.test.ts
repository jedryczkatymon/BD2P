import { describe, expect, it } from "vitest";

import {
	DATABASE_URL,
	insertCopies,
	insertLoan,
	insertUser,
	pgErrorCode,
	withRollback,
} from "./helpers";

describe.skipIf(!DATABASE_URL)("ograniczenia wypożyczeń w bazie", () => {
	it("odrzuca drugie aktywne wypożyczenie tego samego egzemplarza", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client);
			const userA = await insertUser(client);
			const userB = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			await insertLoan(client, copyId, userA);

			const code = await pgErrorCode(client, () =>
				insertLoan(client, copyId, userB),
			);
			expect(code).toBe("23505");
		}));

	it("pozwala na wiele zwróconych wypożyczeń tego samego egzemplarza", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client);
			const user = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			await insertLoan(client, copyId, user, {
				returnedAt: "now",
				loanedOffsetDays: -30,
				dueOffsetDays: -16,
			});
			await insertLoan(client, copyId, user, {
				returnedAt: "now",
				loanedOffsetDays: -10,
				dueOffsetDays: 4,
			});

			// Po zwróconych wypożyczeniach można wypożyczyć ponownie.
			await expect(insertLoan(client, copyId, user)).resolves.toBeTypeOf(
				"string",
			);
		}));

	it("pozwala wypożyczyć różne egzemplarze temu samemu czytelnikowi", () =>
		withRollback(async (client) => {
			const [copyA, copyB] = await insertCopies(client, 2);
			const user = await insertUser(client);
			if (!copyA || !copyB) throw new Error("brak egzemplarzy");

			await insertLoan(client, copyA, user);
			await expect(insertLoan(client, copyB, user)).resolves.toBeTypeOf(
				"string",
			);
		}));

	it("odrzuca termin zwrotu nie późniejszy niż data wypożyczenia", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client);
			const user = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			const sameDay = await pgErrorCode(client, () =>
				insertLoan(client, copyId, user, { dueOffsetDays: 0 }),
			);
			expect(sameDay).toBe("23514");

			const earlier = await pgErrorCode(client, () =>
				insertLoan(client, copyId, user, { dueOffsetDays: -1 }),
			);
			expect(earlier).toBe("23514");
		}));
});

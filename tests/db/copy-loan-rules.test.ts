import { describe, expect, it } from "vitest";

import {
	copyStatus,
	DATABASE_URL,
	insertCopies,
	insertLoan,
	insertUser,
	pgErrorCode,
	withRollback,
} from "./helpers";

describe.skipIf(!DATABASE_URL)("status egzemplarza a wypożyczenia", () => {
	it("wypożyczenie i zwrot nie zmieniają statusu AVAILABLE", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client);
			const user = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			const loanId = await insertLoan(client, copyId, user);
			expect(await copyStatus(client, copyId)).toBe("AVAILABLE");

			await client.query(
				`UPDATE "Loan" SET "returnedAt" = now() WHERE id = $1`,
				[loanId],
			);
			expect(await copyStatus(client, copyId)).toBe("AVAILABLE");
		}));

	it.each(["LOST", "MAINTENANCE"] as const)(
		"odrzuca aktywne wypożyczenie egzemplarza %s",
		(status) =>
			withRollback(async (client) => {
				const [copyId] = await insertCopies(client, 1, status);
				const user = await insertUser(client);
				if (!copyId) throw new Error("brak egzemplarza");

				const code = await pgErrorCode(client, () =>
					insertLoan(client, copyId, user),
				);
				expect(code).toBe("23514");
			}),
	);

	it("dopuszcza zakończone wypożyczenie egzemplarza LOST (historia)", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client, 1, "LOST");
			const user = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			const code = await pgErrorCode(client, () =>
				insertLoan(client, copyId, user, {
					returnedAt: "now",
					loanedOffsetDays: -5,
					dueOffsetDays: 9,
				}),
			);
			expect(code).toBeUndefined();
		}));

	it("blokuje oznaczenie wypożyczonego egzemplarza jako LOST do czasu zwrotu", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client);
			const user = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			const loanId = await insertLoan(client, copyId, user);
			const setLost = () =>
				client.query(`UPDATE "Copy" SET status = 'LOST' WHERE id = $1`, [
					copyId,
				]);

			expect(await pgErrorCode(client, setLost)).toBe("23514");

			await client.query(
				`UPDATE "Loan" SET "returnedAt" = now() WHERE id = $1`,
				[loanId],
			);
			expect(await pgErrorCode(client, setLost)).toBeUndefined();
			expect(await copyStatus(client, copyId)).toBe("LOST");
		}));
});

import { describe, expect, it } from "vitest";

import {
	copyStatus,
	DATABASE_URL,
	insertCopies,
	insertLoan,
	insertUser,
	withRollback,
} from "./helpers";

describe.skipIf(!DATABASE_URL)("trigger synchronizujący Copy.status", () => {
	it("aktywne wypożyczenie ustawia egzemplarz na LOANED", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client);
			const user = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			expect(await copyStatus(client, copyId)).toBe("AVAILABLE");
			await insertLoan(client, copyId, user);
			expect(await copyStatus(client, copyId)).toBe("LOANED");
		}));

	it("zwrot (returnedAt) przywraca egzemplarz do AVAILABLE", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client);
			const user = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			const loanId = await insertLoan(client, copyId, user);
			expect(await copyStatus(client, copyId)).toBe("LOANED");

			await client.query(
				`UPDATE "Loan" SET "returnedAt" = now() WHERE id = $1`,
				[loanId],
			);
			expect(await copyStatus(client, copyId)).toBe("AVAILABLE");
		}));

	it("wstawienie od razu zwróconego wypożyczenia nie zmienia AVAILABLE", () =>
		withRollback(async (client) => {
			const [copyId] = await insertCopies(client);
			const user = await insertUser(client);
			if (!copyId) throw new Error("brak egzemplarza");

			await insertLoan(client, copyId, user, {
				returnedAt: "now",
				loanedOffsetDays: -5,
				dueOffsetDays: 9,
			});
			expect(await copyStatus(client, copyId)).toBe("AVAILABLE");
		}));

	it.each(["LOST", "MAINTENANCE"] as const)(
		"nie zmienia statusu %s po zwrocie",
		(status) =>
			withRollback(async (client) => {
				const [copyId] = await insertCopies(client, 1, status);
				const user = await insertUser(client);
				if (!copyId) throw new Error("brak egzemplarza");

				const loanId = await insertLoan(client, copyId, user);
				// Trigger nie nadpisuje LOST / MAINTENANCE przy wypożyczeniu...
				expect(await copyStatus(client, copyId)).toBe(status);

				// ...ani przy zwrocie.
				await client.query(
					`UPDATE "Loan" SET "returnedAt" = now() WHERE id = $1`,
					[loanId],
				);
				expect(await copyStatus(client, copyId)).toBe(status);
			}),
	);
});

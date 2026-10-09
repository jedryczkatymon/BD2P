import { describe, expect, it } from "vitest";

import {
	DATABASE_URL,
	insertUser,
	pgErrorCode,
	randomPesel,
	withRollback,
} from "./helpers";

describe.skipIf(!DATABASE_URL)("PESEL w bazie", () => {
	it("przyjmuje poprawny 11-cyfrowy PESEL", () =>
		withRollback(async (client) => {
			await expect(
				insertUser(client, { pesel: randomPesel() }),
			).resolves.toBeTypeOf("string");
		}));

	it("odrzuca brak PESEL (NOT NULL)", () =>
		withRollback(async (client) => {
			const code = await pgErrorCode(client, () =>
				insertUser(client, { pesel: null }),
			);
			expect(code).toBe("23502");
		}));

	it.each(["abc", "1234567890", "123456789012", "1234567890a"])(
		"odrzuca niepoprawny format PESEL: %s (CHECK)",
		(pesel) =>
			withRollback(async (client) => {
				const code = await pgErrorCode(client, () =>
					insertUser(client, { pesel }),
				);
				expect(code).toBe("23514");
			}),
	);

	it("odrzuca zduplikowany PESEL (UNIQUE)", () =>
		withRollback(async (client) => {
			const pesel = randomPesel();
			await insertUser(client, { pesel });

			const code = await pgErrorCode(client, () =>
				insertUser(client, { pesel }),
			);
			expect(code).toBe("23505");
		}));
});

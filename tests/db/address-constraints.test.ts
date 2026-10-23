import { randomUUID } from "node:crypto";

import type pg from "pg";
import { describe, expect, it } from "vitest";

import { DATABASE_URL, insertUser, pgErrorCode, withRollback } from "./helpers";

async function ensureCountry(client: pg.Client, code: string, name: string) {
	await client.query(
		`INSERT INTO "Country" (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		[code, name],
	);
}

async function insertPublisher(
	client: pg.Client,
	values: {
		countryCode?: string | null;
		street?: string | null;
		postalCode?: string | null;
		city?: string | null;
	},
) {
	const id = randomUUID();
	await client.query(
		`INSERT INTO "Publisher" (id, name, "countryCode", street, "postalCode", city)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[
			id,
			`Wydawnictwo ${id}`,
			values.countryCode ?? null,
			values.street ?? null,
			values.postalCode ?? null,
			values.city ?? null,
		],
	);
}

describe.skipIf(!DATABASE_URL)("Adres użytkownika", () => {
	it("przyjmuje kod pocztowy w formacie NN-NNN", () =>
		withRollback(async (client) => {
			await insertUser(client, { postalCode: "00-950" });
		}));

	it.each(["00950", "0-0950", "ab-cde", ""])(
		"odrzuca niepoprawny kod pocztowy: %s (CHECK)",
		(postalCode) =>
			withRollback(async (client) => {
				const error = await pgErrorCode(client, () =>
					insertUser(client, { postalCode }),
				);
				expect(error).toBe("23514");
			}),
	);
});

describe.skipIf(!DATABASE_URL)("Adres wydawnictwa", () => {
	it("dopuszcza wydawnictwo bez adresu i z samym miastem", () =>
		withRollback(async (client) => {
			await insertPublisher(client, {});
			await insertPublisher(client, { city: "Londyn" });
		}));

	it("wymaga formatu NN-NNN dla wydawnictwa z Polski (CHECK)", () =>
		withRollback(async (client) => {
			await ensureCountry(client, "PL", "Polska");
			await insertPublisher(client, {
				countryCode: "PL",
				postalCode: "00-950",
				city: "Warszawa",
			});
			const error = await pgErrorCode(client, () =>
				insertPublisher(client, {
					countryCode: "PL",
					postalCode: "00950",
					city: "Warszawa",
				}),
			);
			expect(error).toBe("23514");
		}));

	it("przyjmuje zagraniczny format kodu dla wydawnictwa spoza Polski", () =>
		withRollback(async (client) => {
			await ensureCountry(client, "GB", "Wielka Brytania");
			await insertPublisher(client, {
				countryCode: "GB",
				street: "80 Strand",
				postalCode: "WC2R 0RL",
				city: "Londyn",
			});
		}));

	it.each([
		{ street: "ul. Długa 5", postalCode: null },
		{ street: null, postalCode: "00-950" },
	])("odrzuca ulicę lub kod bez miasta: %o (CHECK)", (values) =>
		withRollback(async (client) => {
			const error = await pgErrorCode(client, () =>
				insertPublisher(client, values),
			);
			expect(error).toBe("23514");
		}),
	);
});

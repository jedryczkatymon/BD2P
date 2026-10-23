import { randomUUID } from "node:crypto";

import type pg from "pg";
import { describe, expect, it } from "vitest";

import {
	DATABASE_URL,
	ensureLanguage,
	pgErrorCode,
	withRollback,
} from "./helpers";

async function insertAuthor(
	client: pg.Client,
	values: { countryCode?: string | null; birthYear?: number | null } = {},
) {
	await client.query(
		`INSERT INTO "Author" (id, "firstName", "lastName", "countryCode", "birthYear")
		 VALUES ($1, 'Jan', 'Testowy', $2, $3)`,
		[randomUUID(), values.countryCode ?? null, values.birthYear ?? null],
	);
}

async function insertPublisher(
	client: pg.Client,
	values: { email?: string | null; website?: string | null } = {},
) {
	const id = randomUUID();
	await client.query(
		`INSERT INTO "Publisher" (id, name, email, website)
		 VALUES ($1, $2, $3, $4)`,
		[id, `Wydawnictwo ${id}`, values.email ?? null, values.website ?? null],
	);
}

describe.skipIf(!DATABASE_URL)("Słowniki krajów i języków", () => {
	it.each(["pl", "POL", "P1"])(
		"odrzuca niepoprawny kod kraju: %s (CHECK)",
		(code) =>
			withRollback(async (client) => {
				const error = await pgErrorCode(client, () =>
					client.query(`INSERT INTO "Country" (code, name) VALUES ($1, $2)`, [
						code,
						`Kraj ${code}`,
					]),
				);
				expect(error).toBe("23514");
			}),
	);

	it.each(["PL", "pol", "p"])(
		"odrzuca niepoprawny kod języka: %s (CHECK)",
		(code) =>
			withRollback(async (client) => {
				const error = await pgErrorCode(client, () =>
					client.query(`INSERT INTO "Language" (code, name) VALUES ($1, $2)`, [
						code,
						`Język ${code}`,
					]),
				);
				expect(error).toBe("23514");
			}),
	);

	it("odrzuca pozycję z nieznanym językiem oryginału (FK)", () =>
		withRollback(async (client) => {
			const error = await pgErrorCode(client, () =>
				client.query(
					`INSERT INTO "Work" (id, title, "originalLanguageCode")
					 VALUES ($1, 'Pozycja', 'zz')`,
					[randomUUID()],
				),
			);
			expect(error).toBe("23503");
		}));

	it("blokuje usunięcie używanego języka (RESTRICT)", () =>
		withRollback(async (client) => {
			await ensureLanguage(client);
			await client.query(
				`INSERT INTO "Work" (id, title, "originalLanguageCode")
				 VALUES ($1, 'Pozycja', 'pl')`,
				[randomUUID()],
			);
			const error = await pgErrorCode(client, () =>
				client.query(`DELETE FROM "Language" WHERE code = 'pl'`),
			);
			expect(error).toBe("23503");
		}));

	it("odrzuca autora z nieznanym krajem (FK)", () =>
		withRollback(async (client) => {
			const error = await pgErrorCode(client, () =>
				insertAuthor(client, { countryCode: "ZZ" }),
			);
			expect(error).toBe("23503");
		}));
});

describe.skipIf(!DATABASE_URL)("Atrybuty autorów i wydawnictw", () => {
	it("przyjmuje autora bez kraju i roku urodzenia", () =>
		withRollback(async (client) => {
			await expect(insertAuthor(client)).resolves.toBeUndefined();
		}));

	it.each([-3001, 2101])(
		"odrzuca rok urodzenia spoza zakresu: %i (CHECK)",
		(birthYear) =>
			withRollback(async (client) => {
				const error = await pgErrorCode(client, () =>
					insertAuthor(client, { birthYear }),
				);
				expect(error).toBe("23514");
			}),
	);

	it("przyjmuje poprawny e-mail i adres www wydawnictwa", () =>
		withRollback(async (client) => {
			await expect(
				insertPublisher(client, {
					email: "kontakt@wydawnictwo.example",
					website: "https://www.wydawnictwo.example",
				}),
			).resolves.toBeUndefined();
		}));

	it.each(["brak-malpy", "a@b", "a b@c.pl"])(
		"odrzuca niepoprawny e-mail: %s (CHECK)",
		(email) =>
			withRollback(async (client) => {
				const error = await pgErrorCode(client, () =>
					insertPublisher(client, { email }),
				);
				expect(error).toBe("23514");
			}),
	);

	it.each(["www.wydawnictwo.pl", "ftp://wydawnictwo.pl"])(
		"odrzuca adres www bez http(s): %s (CHECK)",
		(website) =>
			withRollback(async (client) => {
				const error = await pgErrorCode(client, () =>
					insertPublisher(client, { website }),
				);
				expect(error).toBe("23514");
			}),
	);
});

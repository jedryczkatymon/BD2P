import { randomUUID } from "node:crypto";

import pg from "pg";

export const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Testy bazy działają tylko, gdy ustawiono DATABASE_URL.
 * Każdy test wykonuje się w transakcji, która jest zawsze wycofywana.
 */
export async function withRollback(
	fn: (client: pg.Client) => Promise<void>,
): Promise<void> {
	const client = new pg.Client({ connectionString: DATABASE_URL });
	await client.connect();
	try {
		await client.query("BEGIN");
		await fn(client);
	} finally {
		await client.query("ROLLBACK").catch(() => undefined);
		await client.end();
	}
}

/** Losowy, poprawny formatowo PESEL (11 cyfr), unikalny w obrębie testów. */
export function randomPesel(): string {
	const digits = Array.from({ length: 10 }, () =>
		Math.floor(Math.random() * 10),
	).join("");
	return `7${digits}`;
}

export async function insertUser(
	client: pg.Client,
	overrides: { pesel?: string | null; postalCode?: string } = {},
): Promise<string> {
	const id = randomUUID();
	const pesel = "pesel" in overrides ? overrides.pesel : randomPesel();
	await client.query(
		`INSERT INTO "user" (id, name, email, "firstName", "lastName", pesel, street, "postalCode", city, "updatedAt")
		 VALUES ($1, 'Test Test', $2, 'Test', 'Test', $3, 'ul. Testowa 1', $4, 'Warszawa', now())`,
		[id, `${id}@test.local`, pesel, overrides.postalCode ?? "00-001"],
	);
	return id;
}

/** Zapewnia wpis słownika języków (seed może nie być uruchomiony). */
export async function ensureLanguage(
	client: pg.Client,
	code = "pl",
	name = "polski",
): Promise<string> {
	await client.query(
		`INSERT INTO "Language" (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		[code, name],
	);
	return code;
}

/** Tworzy wydawnictwo, pozycję, wydanie i egzemplarze; zwraca ID egzemplarzy. */
export async function insertCopies(
	client: pg.Client,
	count = 1,
	status: "AVAILABLE" | "LOST" | "MAINTENANCE" = "AVAILABLE",
): Promise<string[]> {
	const publisherId = randomUUID();
	const workId = randomUUID();
	const editionId = randomUUID();
	await ensureLanguage(client);
	await client.query(`INSERT INTO "Publisher" (id, name) VALUES ($1, $2)`, [
		publisherId,
		`Wydawnictwo ${publisherId}`,
	]);
	await client.query(
		`INSERT INTO "Work" (id, title, "originalLanguageCode")
		 VALUES ($1, 'Pozycja testowa', 'pl')`,
		[workId],
	);
	await client.query(
		`INSERT INTO "Edition" (id, "workId", ean, "pageCount", "publicationYear", "languageCode", "publisherId")
		 VALUES ($1, $2, $3, 100, 2020, 'pl', $4)`,
		[editionId, workId, `T${editionId.slice(0, 12)}`, publisherId],
	);

	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		const id = randomUUID();
		await client.query(
			`INSERT INTO "Copy" (id, "editionId", "inventoryNo", status)
			 VALUES ($1, $2, $3, $4::"CopyStatus")`,
			[id, editionId, `INV-${id}`, status],
		);
		ids.push(id);
	}
	return ids;
}

type LoanOptions = {
	returnedAt?: "now" | null;
	loanedOffsetDays?: number;
	dueOffsetDays?: number;
};

export async function insertLoan(
	client: pg.Client,
	copyId: string,
	userId: string,
	options: LoanOptions = {},
): Promise<string> {
	const id = randomUUID();
	const {
		returnedAt = null,
		loanedOffsetDays = 0,
		dueOffsetDays = 14,
	} = options;
	await client.query(
		`INSERT INTO "Loan" (id, "copyId", "userId", "loanedAt", "dueAt", "returnedAt")
		 VALUES ($1, $2, $3,
		   now() + make_interval(days => $4::int),
		   now() + make_interval(days => $5::int),
		   CASE WHEN $6::text = 'now' THEN now() ELSE NULL END)`,
		[id, copyId, userId, loanedOffsetDays, dueOffsetDays, returnedAt],
	);
	return id;
}

export async function copyStatus(
	client: pg.Client,
	copyId: string,
): Promise<string> {
	const { rows } = await client.query<{ status: string }>(
		`SELECT status FROM "Copy" WHERE id = $1`,
		[copyId],
	);
	return rows[0]?.status ?? "";
}

/**
 * Wykonuje zapytanie, które powinno się nie powieść; zwraca kod błędu Postgresa.
 * Używa SAVEPOINT, żeby transakcja testu pozostała użyteczna.
 */
export async function pgErrorCode(
	client: pg.Client,
	run: () => Promise<unknown>,
): Promise<string | undefined> {
	await client.query("SAVEPOINT expect_error");
	try {
		await run();
		await client.query("RELEASE SAVEPOINT expect_error");
		return undefined;
	} catch (error) {
		await client.query("ROLLBACK TO SAVEPOINT expect_error");
		return (error as { code?: string }).code;
	}
}

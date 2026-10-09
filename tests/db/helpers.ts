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
	overrides: { pesel?: string | null } = {},
): Promise<string> {
	const id = randomUUID();
	const pesel = "pesel" in overrides ? overrides.pesel : randomPesel();
	await client.query(
		`INSERT INTO "user" (id, name, email, "firstName", "lastName", pesel, "updatedAt")
		 VALUES ($1, 'Test Test', $2, 'Test', 'Test', $3, now())`,
		[id, `${id}@test.local`, pesel],
	);
	return id;
}

/** Tworzy wydawnictwo, książkę i egzemplarze; zwraca ID egzemplarzy. */
export async function insertCopies(
	client: pg.Client,
	count = 1,
	status: "AVAILABLE" | "LOST" | "MAINTENANCE" = "AVAILABLE",
): Promise<string[]> {
	const publisherId = randomUUID();
	const bookId = randomUUID();
	await client.query(
		`INSERT INTO "Publisher" (id, name, "updatedAt") VALUES ($1, $2, now())`,
		[publisherId, `Wydawnictwo ${publisherId}`],
	);
	await client.query(
		`INSERT INTO "Book" (id, title, ean, "pageCount", "publicationYear", "publisherId", "updatedAt")
		 VALUES ($1, 'Książka testowa', $2, 100, 2020, $3, now())`,
		[bookId, `T${bookId.slice(0, 12)}`, publisherId],
	);

	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		const id = randomUUID();
		await client.query(
			`INSERT INTO "Copy" (id, "bookId", "inventoryNo", status, "updatedAt")
			 VALUES ($1, $2, $3, $4::"CopyStatus", now())`,
			[id, bookId, `INV-${id}`, status],
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
		`INSERT INTO "Loan" (id, "copyId", "userId", "loanedAt", "dueAt", "returnedAt", "updatedAt")
		 VALUES ($1, $2, $3,
		   now() + make_interval(days => $4::int),
		   now() + make_interval(days => $5::int),
		   CASE WHEN $6::text = 'now' THEN now() ELSE NULL END,
		   now())`,
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

import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const SQL_PATH = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"sql",
	"constraints.sql",
);

/**
 * Nakłada na bazę ograniczenia, których Prisma nie wyraża w schemacie
 * (partial unique index, CHECK, trigger). Operacja jest idempotentna.
 */
export async function applyConstraints(
	connectionString = process.env.DATABASE_URL,
) {
	if (!connectionString) {
		throw new Error("DATABASE_URL is required to apply DB constraints");
	}

	const sql = await readFile(SQL_PATH, "utf8");
	const client = new pg.Client({ connectionString });
	await client.connect();

	try {
		await client.query("BEGIN");
		await client.query(sql);
		await client.query("COMMIT");
		console.log("DB constraints applied (index, CHECK, trigger).");
	} catch (error) {
		await client.query("ROLLBACK").catch(() => undefined);

		// 23505 = unique_violation (np. duplikaty aktywnych wypożyczeń).
		if ((error as { code?: string }).code === "23505") {
			const duplicates = await client
				.query<{ copyId: string; count: string }>(
					`SELECT "copyId", count(*)::text AS count
					 FROM "Loan"
					 WHERE "returnedAt" IS NULL
					 GROUP BY "copyId"
					 HAVING count(*) > 1`,
				)
				.catch(() => undefined);
			if (duplicates && duplicates.rows.length > 0) {
				console.error(
					"Egzemplarze z więcej niż jednym aktywnym wypożyczeniem (popraw dane i uruchom ponownie):",
				);
				for (const row of duplicates.rows) {
					console.error(`  copyId=${row.copyId} aktywnych=${row.count}`);
				}
			}
		}
		throw error;
	} finally {
		await client.end();
	}
}

const isMain =
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
	applyConstraints().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}

import { applyConstraints } from "../../prisma/apply-constraints";

/** Nakłada ograniczenia SQL raz przed wszystkimi testami bazy. */
export default async function setup() {
	if (!process.env.DATABASE_URL) return;
	await applyConstraints(process.env.DATABASE_URL);
}

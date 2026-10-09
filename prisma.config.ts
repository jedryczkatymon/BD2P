import "dotenv/config";
import { defineConfig } from "prisma/config";

// Placeholder is enough for `prisma generate` (e.g. Vercel postinstall).
// Real connection string is required at runtime, for `db:push` and `db:seed`.
// The project uses `prisma db push` + prisma/sql/constraints.sql (no migrations).
const databaseUrl =
	process.env.DATABASE_URL ??
	"postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		url: databaseUrl,
	},
});

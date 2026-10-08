import "dotenv/config";
import { defineConfig } from "prisma/config";

// Placeholder is enough for `prisma generate` (e.g. Vercel postinstall).
// Real connection string is required at runtime / for migrate.
const databaseUrl =
	process.env.DATABASE_URL ??
	"postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: databaseUrl,
	},
});

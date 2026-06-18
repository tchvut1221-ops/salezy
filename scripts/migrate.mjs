/**
 * Minimal migration runner for Supabase Postgres.
 *
 * Usage (DATABASE_URL must be in .env.local — Supabase Session pooler string):
 *   node --env-file=.env.local scripts/migrate.mjs              # run all migrations
 *   node --env-file=.env.local scripts/migrate.mjs 0003_add_converting_status.sql
 *
 * Migrations are plain .sql files in supabase/migrations/, applied in filename
 * order. They must be idempotent (the existing files use `if exists` / `if not
 * exists`) since this runner has no applied-history tracking.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Missing DATABASE_URL. Add the Supabase Session pooler connection string to .env.local."
  );
  process.exit(1);
}

const dir = "supabase/migrations";
const only = process.argv[2];
const files = only
  ? [only]
  : (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) {
  console.error("No migration files found.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  for (const f of files) {
    const sql = await readFile(path.join(dir, f), "utf8");
    process.stdout.write(`Running ${f} ... `);
    await client.query(sql);
    console.log("ok");
  }
  console.log(`\nDone — applied ${files.length} migration(s).`);
} catch (err) {
  console.error("\nMigration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

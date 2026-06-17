// Applies the SQL migrations to Supabase via the Management API.
// Usage:  SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migrations.mjs
//
// The access token is a Supabase Personal Access Token (sbp_...) from
// https://supabase.com/dashboard/account/tokens — NOT the service_role key.

import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN env var.");
  process.exit(1);
}

const env = await readFile(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
if (!url) {
  console.error("Could not read NEXT_PUBLIC_SUPABASE_URL from .env.local");
  process.exit(1);
}
const ref = new URL(url).host.split(".")[0];

const files = [
  "supabase/migrations/0001_create_analyses.sql",
  "supabase/migrations/0002_storage_recordings.sql",
];

for (const file of files) {
  const query = await readFile(file, "utf8");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  const body = await res.text();
  console.log(`\n=== ${file} → HTTP ${res.status} ===`);
  console.log(body || "(empty response = success)");
  if (!res.ok) {
    console.error(`Failed on ${file}`);
    process.exit(1);
  }
}

console.log("\n✓ All migrations applied to project", ref);

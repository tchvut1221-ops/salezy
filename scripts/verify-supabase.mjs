// Verifies the Supabase schema/storage setup via the Management API.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/verify-supabase.mjs

import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const env = await readFile(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const ref = new URL(url).host.split(".")[0];

const query = `
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='analyses') as table_exists,
  (select relrowsecurity from pg_class where relname='analyses') as rls_enabled,
  (select count(*) from pg_policies where tablename='analyses') as table_policies,
  (select count(*) from storage.buckets where id='recordings') as bucket_exists,
  (select public from storage.buckets where id='recordings') as bucket_public,
  (select count(*) from pg_policies
     where schemaname='storage' and tablename='objects'
     and policyname like '%recordings%') as storage_policies,
  (select count(*) from pg_publication_tables
     where pubname='supabase_realtime' and tablename='analyses') as realtime_on;
`;

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
console.log("HTTP", res.status);
console.log(JSON.stringify(JSON.parse(await res.text()), null, 2));

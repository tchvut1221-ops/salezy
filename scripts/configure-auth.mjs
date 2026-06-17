// Sets the Supabase Auth Site URL + redirect allow-list via the Management API.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/configure-auth.mjs

import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const env = await readFile(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const ref = new URL(url).host.split(".")[0];

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_url: "http://localhost:3000",
      uri_allow_list: "http://localhost:3000/**",
    }),
  }
);

console.log("HTTP", res.status);
const body = JSON.parse(await res.text());
console.log("site_url:", body.site_url);
console.log("uri_allow_list:", body.uri_allow_list);

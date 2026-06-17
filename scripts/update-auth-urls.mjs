// Updates Supabase Auth to allow both localhost and Vercel production URL
import { readFile } from "node:fs/promises";

const pat = process.env.SUPABASE_ACCESS_TOKEN;
if (!pat) { console.error("Missing SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const ref = new URL(url).host.split(".")[0];

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    site_url: "https://salezy.vercel.app",
    uri_allow_list: [
      "http://localhost:3000/**",
      "https://salezy.vercel.app/**",
      "https://salezy-*.vercel.app/**",
    ].join(","),
  }),
});

const body = await res.json();
console.log("HTTP", res.status);
console.log("site_url:", body.site_url);
console.log("uri_allow_list:", body.uri_allow_list);

// Pushes .env.local vars to Vercel project via Management API
// Usage: node scripts/vercel-env-push.mjs
import { readFile } from "node:fs/promises";

const token = process.env.VERCEL_TOKEN;
if (!token) { console.error("Missing VERCEL_TOKEN"); process.exit(1); }

const projectId = "prj_Hek0TSK1wRlGEotxPCGxAUMdn0jY";
const targets = ["production", "preview", "development"];

const raw = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const parsed = Object.fromEntries(
  raw.split("\n")
    .filter(l => l.match(/^[A-Z_]+=.+/))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const keys = [
  ["NEXT_PUBLIC_SUPABASE_URL",      "plain"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "plain"],
  ["SUPABASE_SERVICE_KEY",          "encrypted"],
  ["OPENAI_API_KEY",                "encrypted"],
  ["INNGEST_EVENT_KEY",             "encrypted"],
  ["INNGEST_SIGNING_KEY",           "encrypted"],
];

const body = keys.map(([key, type]) => ({ key, value: parsed[key], type, target: targets }));

const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const data = await res.json();
if (!res.ok) { console.error("Error:", JSON.stringify(data, null, 2)); process.exit(1); }
console.log(`Added ${data.created?.length ?? 0} env vars:`);
data.created?.forEach(e => console.log(`  ✓ ${e.key}`));

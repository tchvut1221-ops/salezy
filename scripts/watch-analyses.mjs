import { readFileSync } from "node:fs";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;

let prev = new Map();

async function poll() {
  const res = await fetch(
    `${URL_BASE}/rest/v1/analyses?select=id,file_name,status,created_at,updated_at&order=created_at.desc&limit=5`,
    {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
    }
  );
  if (!res.ok) {
    console.log(`POLL_ERROR ${res.status} ${await res.text()}`);
    return;
  }
  const rows = await res.json();
  for (const row of rows) {
    const last = prev.get(row.id);
    if (!last) {
      console.log(`NEW row=${row.id} file="${row.file_name}" status=${row.status}`);
    } else if (last !== row.status) {
      console.log(`STATUS row=${row.id} file="${row.file_name}" ${last} -> ${row.status}`);
    }
    prev.set(row.id, row.status);
  }
}

setInterval(() => {
  poll().catch((e) => console.log(`POLL_EXCEPTION ${e.message}`));
}, 4000);

poll().catch((e) => console.log(`POLL_EXCEPTION ${e.message}`));

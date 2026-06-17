// Triggers a Vercel production deployment from the linked GitHub repo
import { readFile } from "node:fs/promises";

const token = process.env.VERCEL_TOKEN;
if (!token) { console.error("Missing VERCEL_TOKEN"); process.exit(1); }

const projectId = "prj_Hek0TSK1wRlGEotxPCGxAUMdn0jY";
const orgId = "sRYlPjeRKq8L8YzUQ7qznfUX";

// Get project to find gitRepo info
const projRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const proj = await projRes.json();
console.log("Project:", proj.name, "| Repo:", proj.link?.repoId ?? "not linked");

// Trigger deployment via GitHub integration
const body = {
  name: "salezy",
  target: "production",
  gitSource: {
    type: "github",
    ref: "main",
    repoId: proj.link?.repoId,
  },
};

const res = await fetch("https://api.vercel.com/v13/deployments", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const data = await res.json();
if (!res.ok) {
  console.error("Deploy error:", JSON.stringify(data, null, 2));
  process.exit(1);
}
console.log("Deployment started!");
console.log("URL:", `https://${data.url}`);
console.log("Status:", data.readyState);
console.log("Dashboard:", `https://vercel.com/tchvut1221-ops/salezy/${data.id}`);

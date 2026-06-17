// Polls deployment status until ready or failed
const token = process.env.VERCEL_TOKEN;
const deployId = process.argv[2];
if (!token || !deployId) { console.error("Usage: VERCEL_TOKEN=... node vercel-status.mjs <deployId>"); process.exit(1); }

const poll = async () => {
  const res = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await res.json();
  console.log(`[${new Date().toLocaleTimeString()}] Status: ${d.readyState} | URL: https://${d.url}`);
  if (d.readyState === "READY") {
    console.log("\n✅ Deployment LIVE at:", `https://${d.url}`);
    // Get aliases (production URL)
    const aliases = d.alias ?? [];
    if (aliases.length) console.log("Production URL:", `https://${aliases[0]}`);
    return true;
  }
  if (d.readyState === "ERROR" || d.readyState === "CANCELED") {
    console.error("\n❌ Deployment failed:", d.errorMessage ?? d.readyState);
    return true;
  }
  return false;
};

for (let i = 0; i < 30; i++) {
  const done = await poll();
  if (done) break;
  await new Promise(r => setTimeout(r, 10000));
}

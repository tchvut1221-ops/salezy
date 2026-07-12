/**
 * Live stability check for the DISC engine (lib/disc.ts): pulls one real,
 * already-transcribed call by analysis id and runs the DISC scoring N times
 * (default 4), printing type/secondaryType/confidence/axis-scores each run.
 * The whole point of the calibration work this supports is that the SAME
 * transcript must produce the SAME type every run — this is the verification
 * for that requirement, run before merging feature/disc-calibration.
 *
 * Each "run" here is a full self-consistency ensemble: it calls the exact same
 * ensembleDetectSigns() + computeDiscResult() the production pipeline uses
 * (lib/disc.ts), so this script is now a faithful mirror of the real path — no
 * re-implemented dispatch to drift. Total Anthropic calls = runs × K passes
 * (K = DISC_ENSEMBLE_PASSES, default 5).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/disc-stability.ts <analysisId> [runs]
 */
import { ensembleDetectSigns, computeDiscResult, getDiscEnsemblePasses } from "../lib/disc";

async function fetchTranscript(analysisId: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in the environment");
  }
  const res = await fetch(
    `${url}/rest/v1/analyses?id=eq.${analysisId}&select=transcript,file_name`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ transcript: string | null; file_name: string }>;
  const row = rows[0];
  if (!row) throw new Error(`No analysis found with id=${analysisId}`);
  if (!row.transcript) throw new Error(`analysis ${analysisId} (${row.file_name}) has no transcript yet`);
  return row.transcript;
}

async function runOnce(transcript: string) {
  const passes = getDiscEnsemblePasses();
  const raw = await ensembleDetectSigns(transcript, passes);
  return computeDiscResult(raw, passes);
}

async function main() {
  const analysisId = process.argv[2];
  const runs = Number(process.argv[3] ?? 4);
  if (!analysisId) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/disc-stability.ts <analysisId> [runs]");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY in the environment");
    process.exit(1);
  }

  const transcript = await fetchTranscript(analysisId);
  const passes = getDiscEnsemblePasses();
  console.log(
    `Loaded transcript for analysis ${analysisId} (${transcript.length} chars). ` +
      `Running ${runs}x (K=${passes} passes/run → ${runs * passes} Anthropic calls)...\n`
  );

  const results = [];
  for (let i = 1; i <= runs; i++) {
    const r = await runOnce(transcript);
    results.push(r);
    console.log(
      `run ${i}: type=${r.type}${r.secondaryType ? `+${r.secondaryType}` : ""} ` +
        `confidence=${r.confidence} indeterminate=${r.indeterminate} ` +
        `formalInformal=${r.discAxes.formalInformal.score}/18(n=${r.discAxes.formalInformal.signalCount}) ` +
        `dominantPassive=${r.discAxes.dominantPassive.score}/18(n=${r.discAxes.dominantPassive.signalCount})`
    );
  }

  const types = new Set(results.map((r) => r.type));
  const stable = types.size === 1;
  console.log(`\n${stable ? "STABLE" : "UNSTABLE"} — type ${stable ? "did not" : "DID"} change across ${runs} runs (${[...types].join(", ")})`);
  process.exit(stable ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

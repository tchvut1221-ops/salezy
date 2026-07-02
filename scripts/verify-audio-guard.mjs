/**
 * Standalone spike/regression check for the pre-transcription silence guard
 * (see lib/audio.ts checkHasSpeech). Generates synthetic audio fixtures with
 * ffmpeg's lavfi sources and confirms the ffmpeg volumedetect command + the
 * duration/mean_volume regexes correctly classify each one — before any of
 * this runs against real uploads or costs a single OpenAI token.
 *
 * Usage:
 *   node scripts/verify-audio-guard.mjs
 *   node scripts/verify-audio-guard.mjs --fixture-only path/to/out.wav
 *     (generates one 5s silent WAV at the given path and exits — for
 *     manually uploading through the app's UI to test the full pipeline)
 */
import { spawn } from "node:child_process";
import { promises as fs, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const MIN_DURATION_SECONDS = 1;
const SILENCE_THRESHOLD_DB = -50;

function captureFfmpeg(args) {
  return new Promise((resolve, reject) => {
    try {
      chmodSync(ffmpegPath, 0o755);
    } catch {
      // best-effort
    }
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", () => resolve(stderr));
  });
}

async function checkHasSpeech(filePath) {
  const stderr = await captureFfmpeg([
    "-i", filePath,
    "-af", "volumedetect",
    "-f", "null",
    "-",
  ]);

  const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/);
  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : null;

  const volumeMatch = stderr.match(/mean_volume:\s*(-inf|-?\d+(?:\.\d+)?)\s*dB/);
  const meanVolumeDb = volumeMatch
    ? volumeMatch[1] === "-inf" ? -Infinity : Number(volumeMatch[1])
    : null;

  if (durationSeconds === null || durationSeconds < MIN_DURATION_SECONDS) {
    return { ok: false, durationSeconds, meanVolumeDb, reason: "empty" };
  }
  if (meanVolumeDb === null) {
    return { ok: false, durationSeconds, meanVolumeDb, reason: "no_audio" };
  }
  if (meanVolumeDb <= SILENCE_THRESHOLD_DB) {
    return { ok: false, durationSeconds, meanVolumeDb, reason: "silent" };
  }
  return { ok: true, durationSeconds, meanVolumeDb };
}

async function generate(workDir, name, lavfi, seconds) {
  const outPath = path.join(workDir, name);
  const stderr = await captureFfmpeg([
    "-f", "lavfi",
    "-i", lavfi,
    "-t", String(seconds),
    "-ac", "1",
    "-ar", "16000",
    outPath,
  ]);
  try {
    await fs.access(outPath);
  } catch {
    throw new Error(`fixture generation failed for ${name}:\n${stderr.slice(-500)}`);
  }
  return outPath;
}

async function main() {
  if (!ffmpegPath) {
    console.error("❌ ffmpeg binary not found (ffmpeg-static)");
    process.exit(1);
  }

  const fixtureOnlyIdx = process.argv.indexOf("--fixture-only");
  if (fixtureOnlyIdx !== -1) {
    const outPath = path.resolve(process.argv[fixtureOnlyIdx + 1] ?? "silent-test.wav");
    await captureFfmpeg([
      "-f", "lavfi",
      "-i", "anullsrc=r=16000:cl=mono",
      "-t", "5",
      "-ac", "1",
      "-ar", "16000",
      outPath,
    ]);
    console.log(`✅ wrote 5s silent WAV fixture to ${outPath}`);
    return;
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "salezy-guard-check-"));
  let failures = 0;

  try {
    const cases = [
      { name: "too-short.wav", lavfi: "anullsrc=r=16000:cl=mono", seconds: 0.5, expect: "empty" },
      { name: "silent.wav", lavfi: "anullsrc=r=16000:cl=mono", seconds: 5, expect: "silent" },
      { name: "tone.wav", lavfi: "sine=frequency=440:sample_rate=16000", seconds: 5, expect: null },
    ];

    for (const c of cases) {
      const filePath = await generate(workDir, c.name, c.lavfi, c.seconds);
      const result = await checkHasSpeech(filePath);
      const pass = c.expect === null ? result.ok === true : result.reason === c.expect;
      console.log(
        `${pass ? "✅" : "❌"} ${c.name}: ok=${result.ok} reason=${result.reason ?? "-"} ` +
          `duration=${result.durationSeconds}s meanVolume=${result.meanVolumeDb}dB`
      );
      if (!pass) failures++;
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} case(s) failed`);
    process.exit(1);
  }
  console.log("\n✅ all cases passed");
}

main().catch((err) => {
  console.error("❌", err?.message ?? err);
  process.exit(1);
});

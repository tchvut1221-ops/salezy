import { spawn } from "node:child_process";
import { promises as fs, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/** Keep each chunk safely under Whisper's 25MB limit. */
const MAX_BYTES = 24 * 1024 * 1024;
/** Segment length for oversized files (seconds). ~10 min of speech ≈ 10MB. */
const SEGMENT_SECONDS = 600;

export interface AudioChunk {
  buffer: Buffer;
  name: string;
}

/**
 * Re-encode any audio/video container to a 16kHz mono mp3 — the format the
 * transcription API ingests directly. Mono 16kHz is the ASR sweet spot and also
 * shrinks the file, helping large recordings stay under the per-request limit.
 * MUST run inside an Inngest step (uses ffmpeg + the OS temp dir).
 */
export async function convertToMp3(
  buffer: Buffer,
  fileName: string
): Promise<AudioChunk> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary not found (ffmpeg-static)");
  }

  const ext = path.extname(fileName) || ".bin";
  const base = path.basename(fileName, path.extname(fileName));
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "salezy-conv-"));
  const inputPath = path.join(workDir, `input${ext}`);
  const outputPath = path.join(workDir, `${base}.mp3`);

  try {
    await fs.writeFile(inputPath, buffer);
    await runFfmpeg([
      "-i", inputPath,
      "-vn", // drop any video track
      "-ac", "1", // mono
      "-ar", "16000", // 16kHz
      "-c:a", "libmp3lame",
      "-q:a", "4",
      outputPath,
    ]);
    return { buffer: await fs.readFile(outputPath), name: `${base}.mp3` };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Returns the audio as Whisper-sized chunks. Files already under the limit are
 * returned as-is; larger files are split by time with ffmpeg (stream copy, no
 * re-encode). MUST run inside an Inngest step (uses ffmpeg + the OS temp dir).
 */
export async function splitIfNeeded(
  buffer: Buffer,
  fileName: string
): Promise<AudioChunk[]> {
  if (buffer.length <= MAX_BYTES) {
    return [{ buffer, name: fileName }];
  }
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary not found (ffmpeg-static)");
  }

  const ext = path.extname(fileName) || ".mp3";
  const base = path.basename(fileName, ext);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "salezy-"));
  const inputPath = path.join(workDir, `input${ext}`);
  const pattern = path.join(workDir, `${base}_%03d${ext}`);

  try {
    await fs.writeFile(inputPath, buffer);

    await runFfmpeg([
      "-i", inputPath,
      "-f", "segment",
      "-segment_time", String(SEGMENT_SECONDS),
      "-c", "copy",
      "-reset_timestamps", "1",
      pattern,
    ]);

    const files = (await fs.readdir(workDir))
      .filter((f) => f.startsWith(`${base}_`) && f.endsWith(ext))
      .sort();

    const chunks: AudioChunk[] = [];
    for (const f of files) {
      chunks.push({
        buffer: await fs.readFile(path.join(workDir, f)),
        name: f,
      });
    }
    if (chunks.length === 0) {
      throw new Error("ffmpeg produced no audio segments");
    }
    return chunks;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

/** Minimum audio duration to be considered a real recording (seconds). */
const MIN_DURATION_SECONDS = 1;
/** Mean volume at or below this is treated as silence (dBFS). */
const SILENCE_THRESHOLD_DB = -50;

export interface SpeechCheckResult {
  ok: boolean;
  durationSeconds: number | null;
  meanVolumeDb: number | null;
  reason?: "empty" | "no_audio" | "silent";
}

/**
 * Cheap local pre-check (ffmpeg volumedetect, no API calls) that catches
 * empty, truncated, silent, or audio-less uploads before the expensive
 * transcription step runs. Must run BEFORE transcribeAudio/splitIfNeeded —
 * those cost tokens, this doesn't. Command and parsing proven correct in
 * scripts/verify-audio-guard.mjs. MUST run inside an Inngest step (uses
 * ffmpeg + the OS temp dir).
 */
export async function checkHasSpeech(
  buffer: Buffer,
  fileName: string
): Promise<SpeechCheckResult> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary not found (ffmpeg-static)");
  }

  const ext = path.extname(fileName) || ".bin";
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "salezy-check-"));
  const inputPath = path.join(workDir, `input${ext}`);

  try {
    await fs.writeFile(inputPath, buffer);
    const stderr = await captureFfmpeg([
      "-i", inputPath,
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
      ? volumeMatch[1] === "-inf"
        ? -Infinity
        : Number(volumeMatch[1])
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
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Like runFfmpeg, but resolves with stderr text instead of rejecting on a
 * non-zero exit — checkHasSpeech needs to read ffmpeg's diagnostic output
 * (Duration/mean_volume) even when the input is malformed enough that ffmpeg
 * exits non-zero.
 */
function captureFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      chmodSync(ffmpegPath as string, 0o755);
    } catch {
      // best-effort; if the path is wrong spawn() will surface the real error
    }
    const proc = spawn(ffmpegPath as string, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", () => resolve(stderr));
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Bundled binaries can lose the executable bit on serverless — restore it.
    try {
      chmodSync(ffmpegPath as string, 0o755);
    } catch {
      // best-effort; if the path is wrong spawn() will surface the real error
    }
    const proc = spawn(ffmpegPath as string, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))
    );
  });
}

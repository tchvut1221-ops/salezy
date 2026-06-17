import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
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

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
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

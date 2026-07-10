/**
 * Measures the salesperson's share of a diarized transcript by counting
 * characters per speaker label, replacing an earlier LLM percentage guess
 * (see docs/superpowers/specs/2026-07-10-scorecard-verbatim-quotes-and-measured-talk-ratio-design.md).
 * Character count is a proxy for speaking-time share, not literal seconds —
 * formatDiarized (lib/whisper.ts) merges same-speaker segments into text and
 * doesn't preserve per-segment durations.
 */
const SPEAKER_LINE_RE = /^(דובר \d+):\s?(.*)$/;

export function computeRepPercentage(
  transcript: string,
  speakerLabel: string | undefined
): number | null {
  if (!speakerLabel) return null;

  const totals = new Map<string, number>();
  for (const line of transcript.split("\n")) {
    const match = SPEAKER_LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, label, text] = match;
    totals.set(label, (totals.get(label) ?? 0) + text.length);
  }

  // Diarization didn't separate two parties — a ratio wouldn't be meaningful.
  if (totals.size < 2) return null;

  // Exact match on purpose, not fuzzy: if the model's label doesn't match a
  // real transcript label exactly, fail safe to null rather than guess.
  const repChars = totals.get(speakerLabel.trim());
  const totalChars = [...totals.values()].reduce((a, b) => a + b, 0);
  if (repChars == null || totalChars === 0) return null;

  return Math.round((repChars / totalChars) * 1000) / 10;
}

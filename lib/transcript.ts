/**
 * Pure transcript utilities — parsing the stored diarized transcript into
 * speaker turns, and locating verbatim quotes inside it as character RANGES
 * so the UI can highlight them in place.
 *
 * Dependency-free on purpose (like lib/verbatim.ts, lib/talk-ratio.ts and
 * lib/retention-policy.ts) so scripts/transcript-selftest.ts can exercise the
 * whole thing without secrets, a DB, or a React runtime. Everything
 * presentational (which quote came from which signal, what color it gets)
 * lives in components/salezy/transcript-view.tsx instead — this file only
 * knows about strings and offsets.
 *
 * Companion to lib/verbatim.ts: that module answers "is this quote real?"
 * (a boolean membership test, used server-side to drop hallucinated quotes
 * before they ever reach a card). This module answers the harder question the
 * transcript heatmap needs — "*where* is it?" — and must therefore keep an
 * index back to the original, un-normalized string.
 */

// ────────────────────────────────────────────────────────────────────────────
// Speaker turns
// ────────────────────────────────────────────────────────────────────────────

/**
 * The line shape lib/whisper.ts's formatDiarizedSegments() writes:
 * `דובר 1: שלום, מדבר דני`. Same pattern lib/talk-ratio.ts matches on —
 * deliberately anchored and exact rather than fuzzy, so a line that isn't a
 * speaker turn is treated as prose instead of being mis-parsed as one.
 */
const SPEAKER_LINE_RE = /^(דובר \d+):[ \t]?/;

export interface TranscriptTurn {
  /**
   * `דובר 1` etc. Null only when the transcript has no speaker labels at all
   * (formatDiarizedSegments falls back to plain text when the diarization
   * returned no segments).
   */
  speaker: string | null;
  /** The spoken text, WITHOUT the `דובר N: ` prefix. */
  text: string;
  /**
   * Offsets of `text` inside the ORIGINAL transcript string. The invariant
   * `transcript.slice(turn.start, turn.end) === turn.text` always holds — the
   * quote ranges returned by findQuoteRange() are in the same coordinate
   * space, so they can be mapped into a turn by simple subtraction.
   */
  start: number;
  end: number;
  /**
   * True when this line carries no speaker prefix of its own and inherits the
   * previous line's speaker (a wrapped/continuation line). Lets the renderer
   * avoid repeating the speaker badge without having to merge the lines —
   * merging would break the contiguous-offset invariant above.
   */
  isContinuation: boolean;
}

/**
 * Splits the flat stored transcript into structured turns. Every non-empty
 * line becomes one turn; a line without a `דובר N:` prefix inherits the
 * previous turn's speaker.
 *
 * Never throws and never loses text: an empty string yields `[]`, and a
 * transcript with no speaker labels at all yields turns with `speaker: null`.
 */
export function parseTranscriptTurns(transcript: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  if (!transcript) return turns;

  let cursor = 0;
  let lastSpeaker: string | null = null;

  for (const rawLine of transcript.split("\n")) {
    const lineStart = cursor;
    // +1 for the "\n" that split() consumed. Harmlessly overshoots by one past
    // the final line, which is never read again.
    cursor += rawLine.length + 1;

    const leading = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (!line) continue;

    const contentStart = lineStart + leading;
    const match = SPEAKER_LINE_RE.exec(line);

    if (match) {
      lastSpeaker = match[1];
      turns.push({
        speaker: lastSpeaker,
        text: line.slice(match[0].length),
        start: contentStart + match[0].length,
        end: contentStart + line.length,
        isContinuation: false,
      });
    } else {
      turns.push({
        speaker: lastSpeaker,
        text: line,
        start: contentStart,
        end: contentStart + line.length,
        isContinuation: lastSpeaker !== null,
      });
    }
  }

  return turns;
}

/** Distinct speaker labels, in order of first appearance. */
export function transcriptSpeakers(turns: TranscriptTurn[]): string[] {
  const seen: string[] = [];
  for (const t of turns) {
    if (t.speaker && !seen.includes(t.speaker)) seen.push(t.speaker);
  }
  return seen;
}

// ────────────────────────────────────────────────────────────────────────────
// Normalized index — the position-finding core
// ────────────────────────────────────────────────────────────────────────────

/*
 * These three classes reproduce lib/verbatim.ts's normalizeForMatch() exactly,
 * split per-character so the transformation can be replayed incrementally.
 * Written with \u escapes rather than the literal glyphs the original uses so
 * the intent survives any editor/encoding round trip:
 *   ֑-ׇ  Hebrew niqqud + cantillation marks
 *   ׳ ״  geresh / gershayim
 *   – —  en dash / em dash
 */
const NIQQUD_RE = /[֑-ׇ]/;
const PUNCT_RE = /["'׳״.,!?;:()\-–—]/;
const WS_RE = /\s/;

export interface NormalizedIndex {
  /**
   * The normalized text. Byte-for-byte equal to
   * `normalizeForMatch(original)` — asserted over a battery of inputs in
   * scripts/transcript-selftest.ts, which is what keeps this file and
   * lib/verbatim.ts from silently drifting apart.
   */
  normalized: string;
  /**
   * `map[k]` = the offset in the ORIGINAL string of the character that
   * produced `normalized[k]`. One entry per UTF-16 code unit of `normalized`,
   * so `map.length === normalized.length` and a plain `indexOf()` result can
   * be used to index straight into it.
   */
  map: number[];
}

/**
 * Builds `normalizeForMatch(original)` incrementally while recording, for
 * every output character, which original-string offset it came from.
 *
 * This is the whole trick behind the heatmap. normalizeForMatch() DELETES
 * characters (niqqud, punctuation) and COLLAPSES runs of whitespace, so an
 * offset in normalized space has no fixed relationship to an offset in the
 * original — which is exactly why a naive `transcript.indexOf(quote)` fails
 * on the quotes normalizeForMatch() exists to rescue (a quote whose comma,
 * ellipsis or line break differs slightly from the source). Rebuilding the
 * normalized string one character at a time, and remembering each output
 * character's origin, makes the mapping exact and total in both directions.
 *
 * The per-character replay reproduces the original's four stages faithfully:
 *   1. NFKC        — applied per code point (see the caveat below)
 *   2. strip niqqud
 *   3. strip punctuation
 *   4. collapse `\s+` to a single space, then trim — modelled as "remember
 *      that whitespace was seen, and only emit one space if a real character
 *      actually follows". Deferring the space is what makes trailing
 *      whitespace vanish (nothing follows it) and the `out.length > 0` guard
 *      is what makes leading whitespace vanish — i.e. collapse + trim in one
 *      pass, in the same order the original applies them (punctuation is
 *      removed BEFORE the collapse, so `"א .  ב"` normalizes to `"א ב"` in
 *      both implementations).
 *
 * Caveat, deliberate: NFKC is applied per code point rather than to the whole
 * string, because a whole-string normalization can merge two code points into
 * one and would leave no honest origin to record. The two differ only for
 * cross-boundary canonical composition (e.g. a Latin base letter followed by
 * a combining acute). Hebrew is not affected — every Hebrew presentation form
 * is on the Unicode composition-exclusion list, so niqqud never composes into
 * its base letter. In the rare case they did differ, the failure mode is
 * benign and already handled: findQuoteRange() returns null and that one
 * quote simply isn't highlighted.
 */
export function buildNormalizedIndex(original: string): NormalizedIndex {
  const out: string[] = [];
  const map: number[] = [];
  let offset = 0;
  let pendingSpace = false;

  // Iterating a string yields whole code points, so astral characters (emoji)
  // are never split — `cp.length` is 1 or 2 UTF-16 code units accordingly.
  for (const cp of original) {
    const origin = offset;
    offset += cp.length;

    for (const ch of cp.normalize("NFKC")) {
      if (NIQQUD_RE.test(ch) || PUNCT_RE.test(ch)) continue;

      if (WS_RE.test(ch)) {
        // Leading whitespace is dropped outright (nothing emitted yet);
        // anything else is deferred until a real character follows it.
        if (out.length > 0) pendingSpace = true;
        continue;
      }

      if (pendingSpace) {
        out.push(" ");
        map.push(origin);
        pendingSpace = false;
      }

      out.push(ch);
      for (let unit = 0; unit < ch.length; unit++) map.push(origin);
    }
  }

  return { normalized: out.join(""), map };
}

/** A half-open `[start, end)` character range in the ORIGINAL string. */
export interface TranscriptRange {
  start: number;
  end: number;
}

/**
 * Minimum normalized length for a match, mirroring the same floor
 * lib/verbatim.ts's isVerbatimQuote() applies — a one-character "quote" is
 * noise that would match almost anywhere.
 */
const MIN_QUOTE_LENGTH = 2;

/** Number of UTF-16 code units the code point at `i` occupies (1 or 2). */
function codePointLengthAt(s: string, i: number): number {
  const cp = s.codePointAt(i);
  return cp !== undefined && cp > 0xffff ? 2 : 1;
}

/**
 * Locates `quote` inside the transcript and returns its range in ORIGINAL
 * (un-normalized) coordinates, or null when it isn't there.
 *
 * Safe by construction: every failure path — too short, not present, a map
 * lookup that somehow came back undefined — returns null rather than throwing,
 * because the caller's correct response to "can't find it" is simply not to
 * highlight that one quote.
 *
 * @param index    a NormalizedIndex built from `original` (built once by the
 *                 caller and reused across every quote, the same way
 *                 isVerbatimQuote() takes a pre-normalized transcript).
 * @param original the exact string `index` was built from.
 * @param from     offset in NORMALIZED space to start searching at, so callers
 *                 can walk every occurrence rather than only the first.
 */
export function findQuoteRange(
  quote: string,
  index: NormalizedIndex,
  original: string,
  from = 0
): TranscriptRange | null {
  const needle = buildNormalizedIndex(quote).normalized;
  if (needle.length < MIN_QUOTE_LENGTH) return null;

  const at = index.normalized.indexOf(needle, from);
  if (at === -1) return null;

  return rangeFromNormalizedHit(at, needle.length, index, original);
}

/**
 * Normalized-space hit -> original-space range. The one place the
 * normalized→original translation actually happens; both findQuoteRange() and
 * findAllRanges() go through it so the two can't drift.
 */
function rangeFromNormalizedHit(
  at: number,
  length: number,
  index: NormalizedIndex,
  original: string
): TranscriptRange | null {
  const start = index.map[at];
  const lastOrigin = index.map[at + length - 1];
  if (start === undefined || lastOrigin === undefined) return null;

  // `end` is exclusive and must clear the WHOLE original code point that
  // produced the final matched character, not just its first code unit.
  let end = lastOrigin + codePointLengthAt(original, lastOrigin);

  // Then swallow any niqqud sitting immediately after it. Those characters
  // normalize away, so they belong to no match — but they render as combining
  // marks on the last matched letter, and leaving them outside the highlight
  // would visually strand a vowel point just past the highlighted text.
  while (end < original.length && NIQQUD_RE.test(original[end])) end++;

  return start < end ? { start, end } : null;
}

/**
 * Every occurrence of `needle`, left to right. Used for the transcript search
 * box, which needs all hits rather than the first — and gets normalization
 * matching for free, so typing `שלום.` finds `שָׁלוֹם`.
 *
 * `limit` is a cheap runaway guard: a one-character query on a long
 * transcript would otherwise allocate a range per character on every
 * keystroke.
 */
export function findAllRanges(
  needle: string,
  index: NormalizedIndex,
  original: string,
  limit = 400
): TranscriptRange[] {
  const ranges: TranscriptRange[] = [];
  const normalizedNeedle = buildNormalizedIndex(needle).normalized;
  if (normalizedNeedle.length < 1) return ranges;

  let from = 0;
  while (ranges.length < limit) {
    const at = index.normalized.indexOf(normalizedNeedle, from);
    if (at === -1) break;
    const found = rangeFromNormalizedHit(at, normalizedNeedle.length, index, original);
    if (found) ranges.push(found);
    from = at + 1;
  }
  return ranges;
}

/**
 * Resolves a batch of quotes to non-overlapping ranges.
 *
 * Two different signals can cite the same sentence (a key moment and the
 * scorecard category it backs, say). Rather than dropping the loser or
 * rendering two fighting spans, the overlapping candidate's payload is merged
 * onto the winner, so one highlight can honestly announce both sources — which
 * is why the payload is `T[]` and not `T`.
 *
 * Candidates are sorted by start ascending, then by length descending, so the
 * earliest and most specific range wins and shorter fragments fold into it.
 * Only the FIRST occurrence of a given quote is located: a phrase repeated
 * verbatim later in the call is left unhighlighted rather than guessed at,
 * since the source signal refers to one moment, not to every echo of it.
 *
 * The payload lives under `value` (not `values`) purely so the result drops
 * straight into rangesForTurn() and segmentText() with no reshaping.
 */
export function resolveQuoteRanges<T>(
  quotes: Array<{ quote: string; value: T }>,
  index: NormalizedIndex,
  original: string
): Array<TranscriptRange & { value: T[] }> {
  const candidates: Array<TranscriptRange & { value: T }> = [];

  for (const { quote, value } of quotes) {
    const range = findQuoteRange(quote, index, original);
    if (range) candidates.push({ ...range, value });
  }

  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const resolved: Array<TranscriptRange & { value: T[] }> = [];
  for (const candidate of candidates) {
    const clash = resolved.find((r) => candidate.start < r.end && r.start < candidate.end);
    if (clash) {
      if (!clash.value.includes(candidate.value)) clash.value.push(candidate.value);
      continue;
    }
    resolved.push({ start: candidate.start, end: candidate.end, value: [candidate.value] });
  }

  return resolved;
}

// ────────────────────────────────────────────────────────────────────────────
// Segmentation
// ────────────────────────────────────────────────────────────────────────────

export interface TextSegment<T> {
  text: string;
  /** The mark covering this run, or null for plain text. */
  mark: T | null;
}

/**
 * Splits `text` into consecutive runs by which mark (if any) covers each
 * character. Ranges are clamped to the string and may overlap freely — later
 * entries in `marks` win, so a caller can layer e.g. search hits on top of
 * quote highlights without reasoning about intersections at all.
 *
 * Implemented as a paint-then-run-length-encode over a per-character array
 * rather than interval arithmetic: it's O(n) either way for the sizes
 * involved (one speaker turn), and it's correct for every overlap
 * configuration by construction instead of by case analysis.
 *
 * The concatenation of the returned segments always equals `text` exactly, so
 * nothing can be dropped or duplicated on screen.
 */
export function segmentText<T>(
  text: string,
  marks: Array<TranscriptRange & { value: T }>
): Array<TextSegment<T>> {
  if (!text) return [];
  if (marks.length === 0) return [{ text, mark: null }];

  const paint: Array<T | null> = new Array(text.length).fill(null);
  for (const mark of marks) {
    const start = Math.max(0, mark.start);
    const end = Math.min(text.length, mark.end);
    for (let i = start; i < end; i++) paint[i] = mark.value;
  }

  const segments: Array<TextSegment<T>> = [];
  let runStart = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || paint[i] !== paint[runStart]) {
      segments.push({ text: text.slice(runStart, i), mark: paint[runStart] });
      runStart = i;
    }
  }
  return segments;
}

/**
 * Translates transcript-global ranges into a single turn's local coordinates,
 * clamped to that turn and dropping anything that doesn't reach it.
 *
 * Clamping (rather than asserting containment) is what makes a pathological
 * match safe: a quote that somehow spans a line break — and therefore covers
 * the next line's `דובר N:` prefix, which is not part of any turn's text —
 * just gets trimmed to the parts that are actually inside a turn.
 */
export function rangesForTurn<T>(
  turn: TranscriptTurn,
  ranges: Array<TranscriptRange & { value: T }>
): Array<TranscriptRange & { value: T }> {
  const local: Array<TranscriptRange & { value: T }> = [];
  const length = turn.text.length;
  for (const range of ranges) {
    const start = Math.max(0, range.start - turn.start);
    const end = Math.min(length, range.end - turn.start);
    if (end > start) local.push({ start, end, value: range.value });
  }
  return local;
}

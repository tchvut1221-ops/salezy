"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { FileText, Search, User, UserRound } from "lucide-react";
import { Panel, Input, EmptyState, scorecardScoreColor } from "./ui";
import { MOMENT_ICON, ICON_STROKE_WIDTH } from "./icons";
import { PERSONALITY_TYPE_META } from "@/lib/disc-reference";
import { AUDIO_RETENTION_DAYS } from "@/lib/retention-policy";
import {
  buildNormalizedIndex,
  findAllRanges,
  parseTranscriptTurns,
  rangesForTurn,
  resolveQuoteRanges,
  segmentText,
  transcriptSpeakers,
  type TranscriptRange,
  type TranscriptTurn,
} from "@/lib/transcript";
import type { AnalysisResult, MomentType, ScorecardCategoryKey } from "@/types";

/* ────────────────────────────────────────────────────────────────────────────
 * Highlight taxonomy
 *
 * Color encodes VALENCE, the badge encodes the specific signal. That's a
 * deliberate split: with six source types and only the existing D0/D1 palette
 * to draw on (this milestone adds no new color tokens), a distinct hue per
 * type would have meant either inventing colors or reusing the score bands
 * with contradictory meanings. Instead green/amber/red keep the exact meaning
 * they have everywhere else in this app — good / mixed / bad — so the
 * transcript can be scanned for shape at a glance, and every highlight also
 * carries a named badge so the specific signal is never encoded by color
 * alone (WCAG 1.4.1).
 *
 * DISC evidence is the one exception: it has no valence at all (it's evidence
 * of *who the customer is*, not of anything going well or badly), so it uses
 * the personality type's own --disc-* color — a visibly different family from
 * the score bands, which is the point.
 * ──────────────────────────────────────────────────────────────────────────── */

interface HighlightSource {
  /** Stable key for grouping/filtering by kind. */
  kind: string;
  /**
   * Unique per-instance DOM id, set on this source's <mark> so
   * components/salezy/scroll-to-quote.ts can jump here from elsewhere on the
   * page (KeyMoments, Scorecard). Unlike `kind` (shared by every moment of
   * the same MomentType, since it drives legend grouping/filtering), this
   * must be unique per highlight instance.
   */
  anchorId: string;
  /** Human-readable Hebrew label shown on the badge and in the legend. */
  label: string;
  /** Tailwind classes for the inline <mark>. */
  markClass: string;
  /** Tailwind classes for the legend/badge swatch and text. */
  chipClass: string;
  /** Swatch fill for the legend dot. */
  dotClass: string;
}

const MOMENT_LABEL: Record<MomentType, string> = {
  buying_signal: "איתות קנייה",
  objection: "התנגדות",
  pain_point: "נקודת כאב",
  breakthrough: "פריצת דרך",
};

/** Mirrors key-moments.tsx's MOMENT_META color choices so the same signal reads the same in both places. */
const MOMENT_TONE: Record<MomentType, "high" | "mid" | "low" | "primary"> = {
  buying_signal: "high",
  objection: "low",
  pain_point: "mid",
  breakthrough: "primary",
};

const TONE_MARK: Record<"high" | "mid" | "low" | "primary", string> = {
  high: "bg-score-high/20 text-score-high decoration-score-high/60",
  mid: "bg-score-mid/20 text-score-mid decoration-score-mid/60",
  low: "bg-score-low/20 text-score-low decoration-score-low/60",
  primary: "bg-primary/20 text-primary decoration-primary/60",
};

const TONE_CHIP: Record<"high" | "mid" | "low" | "primary", string> = {
  high: "text-score-high ring-score-high/30",
  mid: "text-score-mid ring-score-mid/30",
  low: "text-score-low ring-score-low/30",
  primary: "text-primary ring-primary/30",
};

const TONE_DOT: Record<"high" | "mid" | "low" | "primary", string> = {
  high: "bg-score-high",
  mid: "bg-score-mid",
  low: "bg-score-low",
  primary: "bg-primary",
};

const SCORECARD_CATEGORY_LABEL: Record<ScorecardCategoryKey, string> = {
  opening: "פתיחה",
  discovery: "גילוי צרכים",
  pitch: "הצגת פתרון",
  objectionHandling: "טיפול בהתנגדויות",
  closing: "סגירה",
};

const SCORECARD_CATEGORIES: ScorecardCategoryKey[] = [
  "opening",
  "discovery",
  "pitch",
  "objectionHandling",
  "closing",
];

function toneFor(
  kind: "high" | "mid" | "low" | "primary"
): Omit<HighlightSource, "kind" | "label" | "anchorId"> {
  return { markClass: TONE_MARK[kind], chipClass: TONE_CHIP[kind], dotClass: TONE_DOT[kind] };
}

/**
 * Collects every quote the pipeline already anchored to this transcript.
 *
 * Read-only over `result` — no new signal types are invented here, and a
 * result missing any of these blocks (a v1-only legacy analysis has all three
 * missing) simply contributes nothing. Zero highlights is a correct, fully
 * handled state, not an error.
 */
function collectQuoteSources(
  result: AnalysisResult | null
): Array<{ quote: string; value: HighlightSource }> {
  const sources: Array<{ quote: string; value: HighlightSource }> = [];
  if (!result) return sources;

  (result.keyMoments ?? []).forEach((moment, i) => {
    if (!moment?.quote) return;
    const tone = MOMENT_TONE[moment.type] ?? "primary";
    sources.push({
      quote: moment.quote,
      value: {
        kind: moment.type,
        anchorId: `moment-${i}`,
        label: MOMENT_LABEL[moment.type] ?? "רגע מפתח",
        ...toneFor(tone),
      },
    });
  });

  const scorecard = result.salespersonScorecard;
  if (scorecard) {
    for (const key of SCORECARD_CATEGORIES) {
      const category = scorecard[key];
      if (!category?.quote || category.score == null) continue;
      // Graded by the category's own 1-5 band, using the very same
      // scorecardScoreColor() the Scorecard card uses — so a quote that reads
      // red in the transcript reads red on the scorecard too.
      const band = scorecardScoreColor(category.score);
      const tone: "high" | "mid" | "low" =
        band.dot === "bg-score-high" ? "high" : band.dot === "bg-score-mid" ? "mid" : "low";
      sources.push({
        quote: category.quote,
        value: {
          kind: `scorecard:${key}`,
          anchorId: `scorecard-${key}`,
          label: `סקורקארד · ${SCORECARD_CATEGORY_LABEL[key]} ${category.score}/5`,
          ...toneFor(tone),
        },
      });
    }
  }

  const personality = result.customerPersonality;
  const discMeta = personality?.type ? PERSONALITY_TYPE_META[personality.type] : null;
  if (discMeta && !personality.indeterminate) {
    (personality.signals ?? []).forEach((signal, i) => {
      if (!signal?.quote) return;
      sources.push({
        quote: signal.quote,
        value: {
          kind: "disc",
          anchorId: `disc-${i}`,
          label: `סגנון הלקוח · ${discMeta.he}`,
          // The --disc-* family, deliberately outside the score bands: DISC
          // evidence is neutral, not good or bad. No decoration-* override —
          // the underline inherits currentColor from `text-disc-*`.
          markClass: `bg-zinc-800 ${discMeta.text}`,
          chipClass: `${discMeta.text} ring-zinc-700`,
          dotClass: discMeta.dot,
        },
      });
    });
  }

  return sources;
}

/* ──────────────────────────────────────────────────────────────────────────── */

/** What a single painted run of turn text represents. */
type Mark =
  | { type: "quote"; sources: HighlightSource[] }
  | { type: "search" };

export function TranscriptView({
  transcript,
  result,
}: {
  transcript: string | null;
  result: AnalysisResult | null;
}) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const searchId = useId();

  // The transcript can run to tens of thousands of characters; deferring the
  // query keeps typing responsive while the re-scan catches up.
  const deferredQuery = useDeferredValue(query.trim());

  const text = transcript ?? "";

  const turns = useMemo(() => parseTranscriptTurns(text), [text]);
  const speakers = useMemo(() => transcriptSpeakers(turns), [turns]);

  /**
   * Quote highlights, in transcript-global coordinates. Built once per
   * transcript+result — never per keystroke.
   */
  const highlights = useMemo(() => {
    if (!text) return [];
    const index = buildNormalizedIndex(text);
    return resolveQuoteRanges(collectQuoteSources(result), index, text);
  }, [text, result]);

  /** Legend entries: one per distinct signal kind actually found in this transcript. */
  const legend = useMemo(() => {
    const byKind = new Map<string, { source: HighlightSource; count: number }>();
    for (const highlight of highlights) {
      for (const source of highlight.value) {
        const existing = byKind.get(source.kind);
        if (existing) existing.count += 1;
        else byKind.set(source.kind, { source, count: 1 });
      }
    }
    return [...byKind.values()];
  }, [highlights]);

  /**
   * A normalized index per turn, so search matches land in turn-local
   * coordinates directly. Memoized on the turns, so a keystroke only re-runs
   * the (cheap) indexOf scan, never the (linear) index construction.
   */
  const turnIndexes = useMemo(
    () => turns.map((turn) => buildNormalizedIndex(turn.text)),
    [turns]
  );

  const rows = useMemo(() => {
    return turns.map((turn, i) => {
      const localQuotes = rangesForTurn(turn, highlights);

      // Badges are derived from the turn's quote ranges, not from the painted
      // segments: a search hit landing on top of a quote highlight must not
      // make that quote's badge disappear.
      const badges: HighlightSource[] = [];
      for (const range of localQuotes) {
        for (const source of range.value) {
          if (!badges.some((b) => b.kind === source.kind)) badges.push(source);
        }
      }

      const quoteMarks: Array<TranscriptRange & { value: Mark }> = localQuotes.map((range) => ({
        start: range.start,
        end: range.end,
        value: { type: "quote", sources: range.value },
      }));

      const searchMarks: Array<TranscriptRange & { value: Mark }> = deferredQuery
        ? findAllRanges(deferredQuery, turnIndexes[i], turn.text).map((range) => ({
            ...range,
            value: { type: "search" },
          }))
        : [];

      return {
        turn,
        badges,
        // Search marks come last so they paint OVER quote highlights — a hit
        // inside a highlighted quote stays findable instead of being hidden by
        // the highlight sitting on top of it.
        segments: segmentText<Mark>(turn.text, [...quoteMarks, ...searchMarks]),
        searchHitCount: searchMarks.length,
        kinds: new Set(badges.map((b) => b.kind)),
      };
    });
  }, [turns, highlights, turnIndexes, deferredQuery]);

  const visibleRows = rows.filter(
    (row) =>
      (!deferredQuery || row.searchHitCount > 0) &&
      (!kindFilter || row.kinds.has(kindFilter))
  );

  const totalHits = rows.reduce((sum, row) => sum + row.searchHitCount, 0);

  // `turns.length === 0` covers more than a null column: an empty or
  // whitespace-only transcript string parses to no turns, and would otherwise
  // fall through to the "nothing matches your filter" copy below — which would
  // be actively misleading, since there is no filter and there is no text.
  if (!transcript || turns.length === 0) {
    return (
      <TranscriptShell speakerCount={0}>
        <EmptyState
          icon={FileText}
          title="אין תמלול זמין לשיחה זו"
          description="ייתכן שהשיחה נותחה לפני שהתמלול נשמר, או שההקלטה נמחקה לפני שהתמלול הושלם. הניתוח שלמעלה עדיין תקף."
        />
      </TranscriptShell>
    );
  }

  return (
    <TranscriptShell speakerCount={speakers.length}>
      <div className="space-y-4">
        <div>
          <label htmlFor={searchId} className="sr-only">
            חיפוש בתמלול
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 start-4 my-auto h-4 w-4 text-zinc-500"
              strokeWidth={ICON_STROKE_WIDTH}
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש בתמלול..."
              className="ps-11"
            />
          </div>
          <p role="status" aria-live="polite" className="mt-2 text-caption text-zinc-500">
            {deferredQuery
              ? totalHits > 0
                ? `${
                    totalHits === 1 ? "נמצאה התאמה אחת" : `נמצאו ${totalHits} התאמות`
                  } ${
                    visibleRows.length === 1
                      ? "במקטע אחד"
                      : `ב-${visibleRows.length} מקטעים`
                  }`
                : "לא נמצאו התאמות"
              : turns.length === 1
                ? "מקטע דיבור אחד"
                : `${turns.length} מקטעי דיבור`}
          </p>
        </div>

        {legend.length > 0 && (
          <Legend
            entries={legend}
            active={kindFilter}
            onToggle={(kind) => setKindFilter((prev) => (prev === kind ? null : kind))}
          />
        )}

        {visibleRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            אין מקטעים שתואמים לסינון הנוכחי.
          </p>
        ) : (
          /*
            A scrollable region rather than an inline wall: a 40-minute call is
            tens of thousands of characters, and letting it push the rest of
            the page down would bury everything below it. tabIndex={0} + a
            labelled role="region" is the standard pattern that keeps a
            scrollable box reachable by keyboard.

            max-w-content (D1's 800px reading-width token, first consumer) caps
            the line length: at the page's full width a Hebrew line runs well
            past a comfortable measure, which matters far more for continuous
            speech than for the short card copy elsewhere on this page.
          */
          <div
            role="region"
            aria-label="תמלול השיחה"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- required, not incidental: a scrollable container that isn't focusable can't be scrolled by keyboard at all (WCAG 2.1.1; it's what axe's "scrollable-region-focusable" rule checks for). jsx-a11y flags tabIndex on any non-interactive role and only whitelists role="tabpanel" by default, which would be a lie about what this element is. The labelled focusable region is the correct pattern here.
            tabIndex={0}
            className="max-h-[36rem] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ol className="mx-auto max-w-content space-y-2">
              {visibleRows.map((row) => (
                <TurnRow
                  key={row.turn.start}
                  turn={row.turn}
                  segments={row.segments}
                  badges={row.badges}
                  speakerIndex={row.turn.speaker ? speakers.indexOf(row.turn.speaker) : -1}
                  speakerLabel={speakerDisplayName(row.turn.speaker, speakers, result)}
                />
              ))}
            </ol>
          </div>
        )}
      </div>
    </TranscriptShell>
  );
}

/**
 * Panel chrome + the retention disclosure, shared by the real view and the
 * no-transcript empty state so the privacy copy can never be dropped by
 * accident on one branch.
 */
function TranscriptShell({
  children,
  speakerCount,
}: {
  children: React.ReactNode;
  speakerCount: number;
}) {
  return (
    <Panel
      eyebrow="מה נאמר בפועל"
      title="תמלול השיחה"
      className="mt-8"
    >
      {/*
        Retention disclosure. This screen is the first place Salezy shows a
        user the verbatim contents of a call, so it has to be explicit that
        this text OUTLIVES the recording: lib/retention-policy.ts auto-deletes
        the audio after AUDIO_RETENTION_DAYS, and deletes the transcript never
        — it lives until the user deletes the analysis. Sourced from the same
        constant the upload page and the legal docs quote, so the number here
        can't drift from the actual policy.
      */}
      <p className="mb-5 text-caption leading-relaxed text-zinc-500">
        התמלול נשמר אצלנו עד שתמחקו את הניתוח — הוא <strong className="font-medium text-zinc-400">אינו</strong>{" "}
        נמחק אוטומטית, בשונה מההקלטה המקורית שנמחקת לאחר {AUDIO_RETENTION_DAYS} יום. זהו תוכן
        מילולי של השיחה, כולל דברי הלקוח; שמרו עליו בהתאם. מחיקת הניתוח מוחקת גם את התמלול,
        לצמיתות.
        {speakerCount > 0 && (
          <>
            {" "}
            זיהוי הדוברים אוטומטי ועשוי לשגות.
          </>
        )}
      </p>
      {children}
    </Panel>
  );
}

/**
 * "דובר 1"/"דובר 2" are what the transcript actually stores. When the pipeline
 * managed to identify which of them is the rep (callMetrics.salespersonSpeakerLabel
 * — already produced and persisted today, see lib/analysis.ts, and already
 * trusted for the measured talk ratio) and the call has exactly two speakers,
 * the labels become the names a human would use.
 *
 * Deliberately conservative: with three or more speakers "the other one" isn't
 * a single person, so everyone keeps their raw label rather than being
 * mislabelled "לקוח".
 */
function speakerDisplayName(
  speaker: string | null,
  speakers: string[],
  result: AnalysisResult | null
): string | null {
  if (!speaker) return null;
  const repLabel = result?.callMetrics?.salespersonSpeakerLabel?.trim();
  if (!repLabel || speakers.length !== 2 || !speakers.includes(repLabel)) return speaker;
  return speaker === repLabel ? "איש המכירות" : "לקוח";
}

function Legend({
  entries,
  active,
  onToggle,
}: {
  entries: Array<{ source: HighlightSource; count: number }>;
  active: string | null;
  onToggle: (kind: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-caption text-zinc-500">
        סימונים בתמלול — לחצו כדי לסנן למקטעים הרלוונטיים:
      </p>
      <ul className="flex flex-wrap gap-2">
        {entries.map(({ source, count }) => {
          const isActive = active === source.kind;
          return (
            <li key={source.kind}>
              <button
                type="button"
                onClick={() => onToggle(source.kind)}
                aria-pressed={isActive}
                // Spelled out for screen readers. Several labels already END in
                // a number ("סקורקארד · פתיחה 5/5"), so the bare count chip
                // beside them would otherwise be read as one run-on figure.
                aria-label={`${source.label} — ${
                  count === 1 ? "סימון אחד" : `${count} סימונים`
                } בתמלול`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption ring-1 ring-inset transition-colors ${source.chipClass} ${
                  isActive ? "bg-zinc-800" : "bg-transparent hover:bg-zinc-800/60"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${source.dotClass}`} aria-hidden="true" />
                {source.label}
                <span dir="ltr" className="font-mono tabular-nums text-zinc-500">
                  ({count})
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TurnRow({
  turn,
  segments,
  badges,
  speakerIndex,
  speakerLabel,
}: {
  turn: TranscriptTurn;
  segments: Array<{ text: string; mark: Mark | null }>;
  badges: HighlightSource[];
  speakerIndex: number;
  speakerLabel: string | null;
}) {
  // Speaker identity is carried by surface tint + which edge the rule sits on,
  // NOT by a signal color — the score/DISC palette is spoken for by the
  // heatmap, and reusing it for "who is talking" would make the two encodings
  // fight. Even speakers get the elevated surface, odd ones the base surface.
  const isEven = speakerIndex % 2 === 0;
  const surface = speakerIndex < 0 || isEven ? "bg-elevated" : "bg-zinc-900";
  const rule = speakerIndex < 0 || isEven ? "border-primary/40" : "border-zinc-700";
  const SpeakerIcon = speakerIndex < 0 || isEven ? User : UserRound;

  return (
    <li className={`rounded-lg border-s-2 p-3 ${surface} ${rule}`}>
      {!turn.isContinuation && speakerLabel && (
        <p className="mb-1 flex items-center gap-1.5 text-caption font-medium text-zinc-400">
          <SpeakerIcon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          {speakerLabel}
        </p>
      )}
      {/*
        Explicit dir="rtl" rather than dir="auto": a Hebrew turn that happens to
        open with an English product name or a figure must not flip its base
        direction. Inline runs of digits/Latin inside the sentence need no
        wrapper of their own — the Unicode bidi algorithm already orders them
        correctly inside an RTL paragraph, and that is precisely the case the
        dir="ltr" wrappers elsewhere in this app do NOT cover (those exist for
        ISOLATED numerals — a score, a chart axis, an email field — which have
        no surrounding RTL sentence to orient them).
      */}
      <p dir="rtl" className="text-sm leading-relaxed text-zinc-200">
        {segments.map((segment, i) =>
          segment.mark === null ? (
            <span key={i}>{segment.text}</span>
          ) : segment.mark.type === "search" ? (
            <mark key={i} className="rounded-sm bg-primary/30 px-0.5 text-foreground">
              {segment.text}
            </mark>
          ) : (
            <mark
              key={i}
              id={segment.mark.sources[0].anchorId}
              title={segment.mark.sources.map((s) => s.label).join(" · ")}
              className={`rounded-sm px-0.5 underline decoration-2 underline-offset-4 ${segment.mark.sources[0].markClass}`}
            >
              {segment.text}
            </mark>
          )
        )}
      </p>
      {badges.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <li
              key={badge.kind}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${badge.chipClass}`}
            >
              <BadgeIcon kind={badge.kind} />
              {badge.label}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Key moments reuse the shared MOMENT_ICON map; other sources have no icon of their own. */
function BadgeIcon({ kind }: { kind: string }) {
  const Icon = MOMENT_ICON[kind as MomentType];
  if (!Icon) return null;
  return <Icon className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />;
}


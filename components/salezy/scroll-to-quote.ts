/**
 * Jumps to a quote's highlighted occurrence in the transcript
 * (components/salezy/transcript-view.tsx sets these ids on its <mark>
 * elements) and briefly flashes it. KeyMoments and Scorecard render on the
 * same page as TranscriptView (see analysis-view.tsx) but are unrelated
 * siblings in the component tree with no shared state — `getElementById` is
 * the plain-DOM way to reach across them, the same style already used by
 * accessibility-widget.tsx to toggle classes on `document.documentElement`.
 *
 * A no-op if the transcript has no highlight for this id (e.g. a v1/legacy
 * analysis, or a quote the verbatim check rejected) — nothing to scroll to,
 * not an error.
 */
export function scrollToTranscriptQuote(anchorId: string): void {
  const el = document.getElementById(anchorId);
  if (!el) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });

  el.classList.add("transcript-quote-flash");
  window.setTimeout(() => el.classList.remove("transcript-quote-flash"), 1500);
}

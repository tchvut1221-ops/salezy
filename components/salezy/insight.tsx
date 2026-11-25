import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { ICON_STROKE_WIDTH } from "./icons";

/**
 * The insight voice: what to do next. Amber only, and the only tinted block
 * on the analysis screen — the dashboard's existing "מה לעשות עם זה"
 * treatment (pattern-alert.tsx), made shared: a hairline in --insight at 25%,
 * a 5% tint, a 16px Lightbulb and a 13px/500 label.
 */
export function Insight({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-insight/25 bg-insight/5 p-4 ${className ?? ""}`}>
      <p className="flex items-center gap-2 text-caption font-medium text-insight">
        <Lightbulb className="h-4 w-4 shrink-0" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * The verdict voice: a judgement on what already happened (a strength, a
 * weakness, a failure point). Not a box: a 6px dot and a 13px/500 label in
 * the verdict's score colour, then the text at 14px. An optional value (a
 * score such as "2/5") sits after the label in JetBrains Mono.
 */
export function Verdict({
  tone,
  label,
  value,
  children,
  className,
}: {
  tone: "positive" | "negative";
  label: string;
  value?: string;
  children?: ReactNode;
  className?: string;
}) {
  const dot = tone === "positive" ? "bg-score-high" : "bg-score-low";
  const head = tone === "positive" ? "text-score-high" : "text-score-low";
  return (
    <div className={className}>
      <p className={`flex items-center gap-2 text-caption font-medium ${head}`}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        {label}
        {value && (
          <span dir="ltr" className="font-mono tabular-nums text-zinc-400">
            {value}
          </span>
        )}
      </p>
      {children && <div className="mt-1 text-sm leading-relaxed text-zinc-300">{children}</div>}
    </div>
  );
}

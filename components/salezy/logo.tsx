/**
 * Salezy brand mark — a geometric blue "S" monogram with a growth arrow, drawn
 * as strokes (no fills, no gradient) so it stays crisp at any size and inherits
 * the accent color via `currentColor`. The wordmark is rendered as live text
 * (Inter) rather than traced paths, so it stays sharp and selectable.
 */
export function Logo({
  withWordmark = true,
  className,
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className ?? ""}`}
      aria-label="Salezy"
    >
      <svg
        viewBox="0 0 48 48"
        className="h-7 w-7 shrink-0 text-primary"
        fill="none"
        aria-hidden="true"
      >
        <g
          stroke="currentColor"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M30 13H18V23H30V34H17" />
          <path d="M33 31L40 24M40 24H34M40 24V30" />
        </g>
      </svg>
      {withWordmark && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Salezy
        </span>
      )}
    </span>
  );
}

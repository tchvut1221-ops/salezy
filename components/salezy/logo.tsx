/**
 * Salezy brand mark — a hexagonal "S" monogram whose top stroke flows up into a
 * growth arrow that breaks out of the hexagon (top-right), with two parallel
 * circuit traces. Drawn as strokes (no fills, no gradient) so it stays crisp at
 * any size and inherits the accent color via `currentColor`. The wordmark is
 * rendered as live text (Inter) rather than traced paths, so it stays sharp and
 * selectable.
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
        viewBox="0 0 64 64"
        className="h-8 w-8 shrink-0 text-primary"
        fill="none"
        aria-hidden="true"
      >
        <g
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M32 6 L54 19 L54 45 L32 58 L10 45 L10 19 Z"
            strokeWidth={2.5}
            opacity={0.85}
          />
          <path d="M13 33 L21 27" strokeWidth={2.5} opacity={0.7} />
          <path d="M13 39 L19 34.5" strokeWidth={2.5} opacity={0.7} />
          <path d="M22 46 H40 V32 H24 V22 L48 10" strokeWidth={4} />
          <path d="M48 10 L40 10 M48 10 L48 18" strokeWidth={4} />
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

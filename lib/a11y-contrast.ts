/** WCAG 2.1 contrast-ratio calculator, per the relative-luminance formula in the spec. */
export function getContrastRatio(foreground: string, background: string): number {
  const hexToRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return [r, g, b];
  };

  const getLuminance = (rgb: [number, number, number]): number => {
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const fg = getLuminance(hexToRgb(foreground));
  const bg = getLuminance(hexToRgb(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Every text-on-background pair actually used in the design system
 * (app/globals.css `:root, .dark`), audited during the 2026-07 WCAG 2.1 AA
 * pass. Kept here as the source of truth so a future color change can be
 * re-checked against this exact list via the selftest script instead of
 * re-deriving it from scratch.
 */
export const DESIGN_SYSTEM_PAIRS: {
  name: string;
  foreground: string;
  background: string;
  isLargeText?: boolean;
}[] = [
  { name: "accent-blue on bg-base", foreground: "#4d7eff", background: "#0a0a0f" },
  { name: "accent-blue on bg-surface", foreground: "#4d7eff", background: "#111118" },
  { name: "accent-blue on bg-elevated", foreground: "#4d7eff", background: "#1a1a26" },
  { name: "text-secondary (muted) on bg-base", foreground: "#8888aa", background: "#0a0a0f" },
  { name: "text-secondary (muted) on bg-surface", foreground: "#8888aa", background: "#111118" },
  { name: "text-secondary (muted) on bg-elevated", foreground: "#8888aa", background: "#1a1a26" },
  { name: "text-primary (white) on bg-base", foreground: "#f0f0ff", background: "#0a0a0f" },
  { name: "text-primary (white) on bg-surface", foreground: "#f0f0ff", background: "#111118" },
  { name: "score-high on bg-base", foreground: "#00d4a0", background: "#0a0a0f" },
  { name: "score-mid on bg-base", foreground: "#f5a623", background: "#0a0a0f" },
  { name: "score-low on bg-base", foreground: "#ff4d6a", background: "#0a0a0f" },
];

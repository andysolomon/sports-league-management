/**
 * Pure helpers for the hand-rolled bento dashboard widgets (WSM-000136 P4).
 * No charting dependency — these turn numbers into SVG geometry / intensity
 * buckets, kept pure so they're unit-testable and the widgets stay presentational.
 */

/** Fraction 0..1 of value/max, clamped; 0 when max ≤ 0. */
export function fraction(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

/** Whole-percent (0..100) of value/max. */
export function percent(value: number, max: number): number {
  return Math.round(fraction(value, max) * 100);
}

/** stroke-dasharray split for a ring gauge: [filled, remaining] of circumference. */
export function gaugeDash(
  frac: number,
  circumference: number,
): { dash: number; gap: number } {
  const f = Math.max(0, Math.min(1, frac));
  const dash = f * circumference;
  return { dash, gap: circumference - dash };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Map a series to an SVG `points` string within a `width`×`height` box. A flat
 * series renders as a centered horizontal line; a single point spans the width.
 */
export function sparklinePoints(
  values: number[],
  width: number,
  height: number,
  pad = 2,
): string {
  if (values.length === 0) return "";
  const innerH = height - pad * 2;
  if (values.length === 1) {
    const y = round(pad + innerH / 2);
    return `${pad},${y} ${width - pad},${y}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const innerW = width - pad * 2;
  // A flat series has no range — center it rather than pinning to an edge.
  if (max === min) {
    const y = round(pad + innerH / 2);
    return values
      .map((_, i) => `${round(pad + (i / (values.length - 1)) * innerW)},${y}`)
      .join(" ");
  }
  const range = max - min;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * innerW;
      const y = pad + (1 - (v - min) / range) * innerH;
      return `${round(x)},${round(y)}`;
    })
    .join(" ");
}

/** Intensity bucket 0..4 for a heatmap cell (GitHub-style). */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const r = count / max;
  if (r > 0.75) return 4;
  if (r > 0.5) return 3;
  if (r > 0.25) return 2;
  return 1;
}

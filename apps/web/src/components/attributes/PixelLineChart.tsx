/**
 * Hand-rolled pixel-art line chart (Phase 2 / WSM-000060).
 *
 * No recharts — the antialiased polish fights the 8-bit aesthetic.
 * Renders a chunky-stroke polyline with filled-square vertices and
 * `image-rendering: pixelated` for the crispest possible look.
 *
 * Skips null y values: a missing season's segment is omitted, and
 * the line picks up at the next non-null point.
 */
import { POSITION_GROUPS } from "@/lib/attributes/position-groups";

export interface PixelLineChartPoint {
  /** Display label for the x-axis tick (e.g. season name). */
  x: string;
  /** Numeric y value, null to omit the point + segment. */
  y: number | null;
}

export interface PixelLineChartProps {
  points: PixelLineChartPoint[];
  /** Inclusive y-range. Defaults to 0..100 (attribute scale). */
  yMin?: number;
  yMax?: number;
  /** SVG dimensions. */
  width?: number;
  height?: number;
  /** Aria label for screen readers. */
  ariaLabel?: string;
}

const PADDING = { top: 16, right: 16, bottom: 36, left: 36 };

export default function PixelLineChart({
  points,
  yMin = 0,
  yMax = 100,
  width = 480,
  height = 240,
  ariaLabel = "Line chart",
}: PixelLineChartProps) {
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  // Empty state — render an empty axis frame.
  if (points.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        style={{ imageRendering: "pixelated" }}
      >
        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={innerW}
          height={innerH}
          fill="var(--color-card)"
          stroke="var(--color-border)"
          strokeWidth={2}
        />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          fill="var(--color-muted-foreground)"
          fontSize={12}
        >
          No data
        </text>
      </svg>
    );
  }

  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const yScale = (y: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, y));
    const t = (clamped - yMin) / (yMax - yMin);
    return PADDING.top + innerH - t * innerH;
  };
  const xPos = (i: number) =>
    points.length === 1 ? PADDING.left + innerW / 2 : PADDING.left + i * xStep;

  // Build line segments, skipping over null y values.
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a.y === null || b.y === null) continue;
    segments.push({
      x1: xPos(i),
      y1: yScale(a.y),
      x2: xPos(i + 1),
      y2: yScale(b.y),
    });
  }

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      style={{ imageRendering: "pixelated" }}
    >
      {/* Plot area background */}
      <rect
        x={PADDING.left}
        y={PADDING.top}
        width={innerW}
        height={innerH}
        fill="var(--color-card)"
        stroke="var(--color-border)"
        strokeWidth={2}
      />

      {/* Y-axis labels: min, mid, max */}
      {[yMin, Math.round((yMin + yMax) / 2), yMax].map((tick) => (
        <text
          key={tick}
          x={PADDING.left - 6}
          y={yScale(tick) + 4}
          textAnchor="end"
          fill="var(--color-muted-foreground)"
          fontSize={11}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {tick}
        </text>
      ))}

      {/* X-axis labels under each point */}
      {points.map((p, i) => (
        <text
          key={`x-${i}`}
          x={xPos(i)}
          y={height - PADDING.bottom + 16}
          textAnchor="middle"
          fill="var(--color-muted-foreground)"
          fontSize={10}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {p.x}
        </text>
      ))}

      {/* Chunky line segments */}
      {segments.map((s, i) => (
        <line
          key={`seg-${i}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="var(--color-primary)"
          strokeWidth={4}
          strokeLinecap="square"
        />
      ))}

      {/* Square vertices for each non-null point */}
      {points.map((p, i) =>
        p.y === null ? null : (
          <rect
            key={`v-${i}`}
            x={xPos(i) - 5}
            y={yScale(p.y) - 5}
            width={10}
            height={10}
            fill="var(--color-primary)"
            stroke="var(--color-foreground)"
            strokeWidth={2}
          />
        ),
      )}
    </svg>
  );
}

// Re-export here so the chart module is the single source of attribute-page
// imports for the position-group taxonomy.
export { POSITION_GROUPS };

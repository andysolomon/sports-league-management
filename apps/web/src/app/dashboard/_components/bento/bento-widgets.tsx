import { cn } from "@/lib/utils";
import {
  fraction,
  gaugeDash,
  heatLevel,
  percent,
  sparklinePoints,
} from "@/lib/bento";

/** A bento tile. */
export function BentoCard({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-5",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Ring gauge showing value/max as a percentage. */
export function RadialGauge({
  value,
  max,
  caption,
}: {
  value: number;
  max: number;
  caption: string;
}) {
  const size = 104;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const { dash, gap } = gaugeDash(fraction(value, max), c);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            stroke="currentColor"
            className="text-border"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            stroke="currentColor"
            className="text-foreground"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xl font-semibold text-foreground">
            {percent(value, max)}%
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

/** Minimal trend line. */
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const w = 260;
  const h = 52;
  const pts = sparklinePoints(values, w, h, 4);
  if (!pts) {
    return (
      <div className="flex h-[52px] items-center text-xs text-muted-foreground">
        No data yet.
      </div>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-[52px] w-full text-foreground", className)}
      role="img"
      aria-label="Trend"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const HEAT_CLASSES = [
  "bg-muted",
  "bg-foreground/20",
  "bg-foreground/40",
  "bg-foreground/60",
  "bg-foreground/90",
] as const;

/** GitHub-style intensity grid; one cell per week. */
export function WeekHeatmap({ counts }: { counts: number[] }) {
  if (counts.length === 0) {
    return <p className="text-xs text-muted-foreground">No games yet.</p>;
  }
  const max = Math.max(1, ...counts);
  return (
    <div className="flex flex-wrap gap-1">
      {counts.map((count, i) => (
        <div
          key={i}
          title={`Week ${i + 1}: ${count} game${count === 1 ? "" : "s"}`}
          className={cn("h-4 w-4 rounded-sm", HEAT_CLASSES[heatLevel(count, max)])}
        />
      ))}
    </div>
  );
}

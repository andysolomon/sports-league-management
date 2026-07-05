import type { DriveChartSegment, DriveResultToken } from "@/lib/gamecast";
import { driveResultLabel, driveResultToken } from "@/lib/gamecast";

const TOKEN_FILL: Record<DriveResultToken, string> = {
  accent: "fill-accent",
  primary: "fill-primary",
  muted: "fill-surface-3",
  danger: "fill-danger",
  subtle: "fill-border-strong",
};

interface DriveChartProps {
  segments: DriveChartSegment[];
  homeLabel: string;
  awayLabel: string;
  animate: boolean;
}

const ROW_HEIGHT = 14;
const FIELD_HEIGHT = 48;
const PAD_X = 4;

export default function DriveChart({
  segments,
  homeLabel,
  awayLabel,
  animate,
}: DriveChartProps) {
  const revealed = segments.filter((s) => s.isRevealed);
  const chartHeight = Math.max(revealed.length, 1) * ROW_HEIGHT + FIELD_HEIGHT + 24;
  const width = 100 + PAD_X * 2;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        <div className="mb-2 flex justify-between font-mono text-caption-12 text-text-subtle">
          <span>{homeLabel}</span>
          <span>{awayLabel}</span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          className="w-full text-border"
          role="img"
          aria-label="Drive chart"
        >
          <Field width={width} y={0} />
          {revealed.map((seg, i) => (
            <DriveBar
              key={seg.driveId}
              segment={seg}
              y={FIELD_HEIGHT + 8 + i * ROW_HEIGHT}
              width={width}
              animate={animate}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function Field({ width, y }: { width: number; y: number }) {
  const x0 = PAD_X;
  const w = 100;
  return (
    <g transform={`translate(0, ${y})`}>
      <rect
        x={x0}
        y={0}
        width={w}
        height={FIELD_HEIGHT}
        rx={2}
        className="fill-surface-2 stroke-border"
        strokeWidth={0.5}
      />
      <line
        x1={x0 + w / 2}
        y1={0}
        x2={x0 + w / 2}
        y2={FIELD_HEIGHT}
        className="stroke-border"
        strokeWidth={0.5}
        strokeDasharray="2 2"
      />
      {[0, 25, 50, 75, 100].map((tick) => (
        <line
          key={tick}
          x1={x0 + tick}
          y1={FIELD_HEIGHT - 4}
          x2={x0 + tick}
          y2={FIELD_HEIGHT}
          className="stroke-border-strong"
          strokeWidth={0.5}
        />
      ))}
    </g>
  );
}

function DriveBar({
  segment,
  y,
  width,
  animate,
}: {
  segment: DriveChartSegment;
  y: number;
  width: number;
  animate: boolean;
}) {
  const x0 = PAD_X;
  const start = x0 + Math.min(segment.startChart, segment.endChart);
  const barW = Math.max(Math.abs(segment.endChart - segment.startChart), 1.5);
  const token: DriveResultToken = segment.isCurrent
    ? "accent"
    : driveResultToken(segment.endReason);
  const fill = TOKEN_FILL[token];
  const transition = animate ? "transition-all duration-300 ease-out" : undefined;

  return (
    <g transform={`translate(0, ${y})`} className={transition}>
      <rect
        x={start}
        y={2}
        width={barW}
        height={8}
        rx={2}
        className={`${fill} ${segment.isCurrent ? "opacity-100" : "opacity-80"}`}
      >
        <title>
          Drive {segment.driveId}: {driveResultLabel(segment.endReason)}
        </title>
      </rect>
    </g>
  );
}

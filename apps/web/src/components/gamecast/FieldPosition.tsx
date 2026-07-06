export interface FieldPositionTeam {
  name: string;
  abbr: string;
  color: string;
}

export interface FieldPositionProps {
  homeTeam: FieldPositionTeam;
  awayTeam: FieldPositionTeam;
  ballChartYard: number;
  firstDownChartYard: number | null;
  losChartYard: number;
  possession: "home" | "away" | null;
  showLegend?: boolean;
}

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 200;
const END_ZONE_WIDTH = 60;
const TURF_WIDTH = 360;

const LOS_COLOR = "#4a9be0";
const FIRST_DOWN_COLOR = "#e0b64a";
const BALL_COLOR = "#c47b3a";

function chartToX(chartYard: number): number {
  return END_ZONE_WIDTH + chartYard * 3;
}

export default function FieldPosition({
  homeTeam,
  awayTeam,
  ballChartYard,
  firstDownChartYard,
  losChartYard,
  possession,
  showLegend = true,
}: FieldPositionProps) {
  const driveDir = possession === "home" ? 1 : possession === "away" ? -1 : 0;
  const possessionColor =
    possession === "home"
      ? homeTeam.color
      : possession === "away"
        ? awayTeam.color
        : undefined;
  const ballX = chartToX(ballChartYard);

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full rounded-card border border-border"
        role="img"
        aria-label="Field position"
      >
        <rect
          x={0}
          y={0}
          width={END_ZONE_WIDTH}
          height={VIEW_HEIGHT}
          fill={homeTeam.color}
          opacity={0.9}
        />
        <rect
          x={END_ZONE_WIDTH + TURF_WIDTH}
          y={0}
          width={END_ZONE_WIDTH}
          height={VIEW_HEIGHT}
          fill={awayTeam.color}
          opacity={0.9}
        />
        <text
          x={30}
          y={100}
          fill="#fff"
          fontSize={15}
          fontWeight={800}
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          transform="rotate(-90 30 100)"
          opacity={0.92}
        >
          {homeTeam.abbr}
        </text>
        <text
          x={450}
          y={100}
          fill="#fff"
          fontSize={15}
          fontWeight={800}
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          transform="rotate(90 450 100)"
          opacity={0.92}
        >
          {awayTeam.abbr}
        </text>

        <rect
          x={END_ZONE_WIDTH}
          y={0}
          width={TURF_WIDTH}
          height={VIEW_HEIGHT}
          className="fill-surface-2"
        />

        {Array.from({ length: 11 }, (_, i) => i * 10).map((chartYard) => (
          <line
            key={`yard-${chartYard}`}
            x1={chartToX(chartYard)}
            y1={0}
            x2={chartToX(chartYard)}
            y2={VIEW_HEIGHT}
            className={
              chartYard === 50 ? "stroke-border-strong" : "stroke-border"
            }
            strokeWidth={chartYard === 50 ? 1.4 : 1}
          />
        ))}

        {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((chartYard) => (
          <g key={`hash-${chartYard}`}>
            <line
              x1={chartToX(chartYard)}
              y1={62}
              x2={chartToX(chartYard)}
              y2={70}
              className="stroke-border-strong"
              strokeWidth={1}
            />
            <line
              x1={chartToX(chartYard)}
              y1={130}
              x2={chartToX(chartYard)}
              y2={138}
              className="stroke-border-strong"
              strokeWidth={1}
            />
          </g>
        ))}

        {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((chartYard) => {
          const label = chartYard <= 50 ? chartYard : 100 - chartYard;
          return (
            <text
              key={`num-${chartYard}`}
              x={chartToX(chartYard)}
              y={108}
              className="fill-text-subtle"
              fontSize={13}
              fontWeight={700}
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {label}
            </text>
          );
        })}

        {firstDownChartYard != null ? (
          <line
            x1={chartToX(firstDownChartYard)}
            y1={0}
            x2={chartToX(firstDownChartYard)}
            y2={VIEW_HEIGHT}
            stroke={FIRST_DOWN_COLOR}
            strokeWidth={2.4}
          />
        ) : null}

        <line
          x1={chartToX(losChartYard)}
          y1={0}
          x2={chartToX(losChartYard)}
          y2={VIEW_HEIGHT}
          stroke={LOS_COLOR}
          strokeWidth={2.4}
        />

        <circle
          cx={ballX}
          cy={100}
          r={11}
          className="fill-bg"
          opacity={0.55}
        />
        <ellipse
          cx={ballX}
          cy={100}
          rx={8}
          ry={5}
          fill={BALL_COLOR}
          stroke="#fff"
          strokeWidth={1.4}
        />

        {driveDir !== 0 && possessionColor ? (
          <g>
            <line
              x1={ballX + driveDir * 15}
              y1={100}
              x2={ballX + driveDir * 22}
              y2={100}
              stroke={possessionColor}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <path
              d={`M${ballX + driveDir * 22} 100 l${-driveDir * 6} -5 v10 z`}
              fill={possessionColor}
            />
          </g>
        ) : null}
      </svg>

      {showLegend ? (
        <div className="mt-2 flex flex-wrap gap-4 text-caption-12 text-text-subtle">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-[3px] w-3.5 rounded-sm"
              style={{ backgroundColor: LOS_COLOR }}
            />
            Line of scrimmage
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-[3px] w-3.5 rounded-sm"
              style={{ backgroundColor: FIRST_DOWN_COLOR }}
            />
            First down
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: BALL_COLOR }}
            />
            Ball
          </span>
        </div>
      ) : null}
    </div>
  );
}

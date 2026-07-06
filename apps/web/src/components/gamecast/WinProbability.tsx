"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface WinProbabilityTeam {
  abbr: string;
  color: string;
}

export interface WinProbabilityProps {
  series: number[];
  currentIndex: number;
  mode: "sim" | "review";
  homeTeam: WinProbabilityTeam;
  awayTeam: WinProbabilityTeam;
}

function teamSoftFill(color: string): string {
  return `${color}2e`;
}

export default function WinProbability({
  series,
  currentIndex,
  mode,
  homeTeam,
  awayTeam,
}: WinProbabilityProps) {
  const total = Math.max(series.length - 1, 1);
  const endIndex =
    mode === "sim"
      ? Math.min(currentIndex, series.length - 1)
      : series.length - 1;
  const visibleSeries = series.slice(0, endIndex + 1);
  const currentWinPct =
    series[Math.min(currentIndex, series.length - 1)] ?? 50;

  const points = visibleSeries.map((winPct, i) => [
    (i / total) * 100,
    100 - winPct,
  ] as const);

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1][0].toFixed(2)} 50 L0 50 Z`
      : "";

  const showMarker = currentIndex > 0 && series.length > 0;
  const markerX = (currentIndex / total) * 100;
  const markerY = 100 - (series[currentIndex] ?? currentWinPct);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="font-mono text-caption-12 font-bold uppercase tracking-wide text-text-muted">
          Illustrative model
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="inline-flex text-text-subtle transition-colors hover:text-text-muted"
              aria-label="About win probability model"
            >
              <Info className="size-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent sideOffset={4}>
              Estimated from score and time remaining — not a forecast
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="mb-2 flex items-baseline justify-between gap-3">
        <TeamChip abbr={homeTeam.abbr} color={homeTeam.color} />
        <span className="font-mono text-[20px] font-extrabold leading-none tabular-nums text-foreground">
          {currentWinPct}%
        </span>
        <TeamChip abbr={awayTeam.abbr} color={awayTeam.color} align="right" />
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="block h-[120px] w-full rounded-card border border-border bg-surface-2"
        role="img"
        aria-label="Win probability chart"
      >
        <rect x={0} y={0} width={100} height={50} fill={teamSoftFill(homeTeam.color)} />
        <rect x={0} y={50} width={100} height={50} fill={teamSoftFill(awayTeam.color)} />
        <line
          x1={0}
          y1={50}
          x2={100}
          y2={50}
          className="stroke-border-strong"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        {areaPath ? (
          <path d={areaPath} fill={homeTeam.color} opacity={0.14} />
        ) : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={homeTeam.color}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {showMarker ? (
          <>
            <line
              x1={markerX}
              y1={0}
              x2={markerX}
              y2={100}
              className="stroke-text-muted"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={markerX}
              cy={markerY}
              r={2.4}
              className="fill-foreground stroke-bg"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
      </svg>

      <div className="mt-1.5 flex justify-between font-mono text-[10px] leading-none text-text-subtle">
        <span>Kickoff</span>
        <span>Q2</span>
        <span>Half</span>
        <span>Q4</span>
        <span>Final</span>
      </div>
    </div>
  );
}

function TeamChip({
  abbr,
  color,
  align = "left",
}: {
  abbr: string;
  color: string;
  align?: "left" | "right";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-caption-12 font-bold ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
      style={{ color }}
    >
      <span
        className="inline-block size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {abbr}
    </span>
  );
}

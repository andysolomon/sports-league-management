import {
  formatGameClock,
  formatQuarterLabel,
  type TeamDisplay,
} from "@/lib/gamecast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GamecastMode } from "./gamecast-transport-logic";

export interface GamecastScoreboardProps {
  homeTeamName: string;
  awayTeamName: string;
  homeDisplay: TeamDisplay;
  awayDisplay: TeamDisplay;
  homeScore: number;
  awayScore: number;
  quarter: number | null;
  clockSeconds: number | null;
  isComplete: boolean;
  isPreGame: boolean;
  possession: "home" | "away" | null;
  mode: GamecastMode;
  playIndex: number;
  totalPlays: number;
  weekLabel?: string | null;
  reducedMotion?: boolean;
}

export default function GamecastScoreboard({
  homeTeamName,
  awayTeamName,
  homeDisplay,
  awayDisplay,
  homeScore,
  awayScore,
  quarter,
  clockSeconds,
  isComplete,
  isPreGame,
  possession,
  mode,
  playIndex,
  totalPlays,
  weekLabel,
  reducedMotion = false,
}: GamecastScoreboardProps) {
  const periodLabel =
    quarter === null || isPreGame
      ? "Pre-game"
      : isComplete
        ? "Final"
        : formatQuarterLabel(quarter);
  const clockLabel =
    clockSeconds !== null && !isComplete && !isPreGame
      ? formatGameClock(clockSeconds)
      : null;

  return (
    <div
      className="rounded-card border border-border bg-surface px-5 py-[18px]"
      data-testid="gamecast-scoreboard"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-text-muted">
          {weekLabel ?? "Gamecast"}
        </p>
        <StatusBadge
          mode={mode}
          playIndex={playIndex}
          totalPlays={totalPlays}
          isComplete={isComplete}
          isPreGame={isPreGame}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5">
        <TeamCol
          name={homeTeamName}
          display={homeDisplay}
          score={homeScore}
          align="left"
          hasPossession={possession === "home"}
        />
        <div className="shrink-0 text-center">
          <div
            className={cn(
              "font-mono text-[11px] font-bold uppercase tracking-[2px]",
              isComplete ? "text-accent" : "text-text-muted",
            )}
          >
            {periodLabel}
          </div>
          {clockLabel ? (
            <div className="mt-1 font-mono text-[24px] font-bold tabular-nums leading-none text-foreground">
              {clockLabel}
            </div>
          ) : isComplete ? (
            <div className="mt-1 font-mono text-[24px] font-bold leading-none text-accent">
              Final
            </div>
          ) : null}
        </div>
        <TeamCol
          name={awayTeamName}
          display={awayDisplay}
          score={awayScore}
          align="right"
          hasPossession={possession === "away"}
        />
      </div>
    </div>
  );
}

function StatusBadge({
  mode,
  playIndex,
  totalPlays,
  isComplete,
  isPreGame,
  reducedMotion,
}: {
  mode: GamecastMode;
  playIndex: number;
  totalPlays: number;
  isComplete: boolean;
  isPreGame: boolean;
  reducedMotion: boolean;
}) {
  if (mode === "review") {
    return (
      <Badge variant="success" className="font-mono text-[10px] uppercase">
        Review · {playIndex}/{totalPlays}
      </Badge>
    );
  }

  if (isPreGame) {
    return (
      <Badge variant="outline" className="font-mono text-[10px] uppercase">
        Ready
      </Badge>
    );
  }

  if (isComplete) {
    return (
      <Badge variant="secondary" className="font-mono text-[10px] uppercase">
        Final
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1.5 font-mono text-[10px] uppercase">
      <span
        className={cn(
          "inline-block size-2 rounded-full bg-destructive",
          !reducedMotion && "animate-pulse",
        )}
        aria-hidden
      />
      Live
    </Badge>
  );
}

function TeamCol({
  name,
  display,
  score,
  align,
  hasPossession,
}: {
  name: string;
  display: TeamDisplay;
  score: number;
  align: "left" | "right";
  hasPossession: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        align === "right" ? "flex-row-reverse text-right" : "text-left",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-control font-mono text-[14px] font-extrabold text-white",
          hasPossession && "ring-[3px] ring-accent ring-offset-2 ring-offset-surface",
        )}
        style={{ backgroundColor: display.color }}
        aria-hidden
      >
        {display.abbr}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold text-foreground">{name}</div>
        <div
          className="font-mono text-stat-30 font-extrabold tabular-nums tracking-tight text-foreground"
          data-testid={`gamecast-score-${align === "left" ? "home" : "away"}`}
        >
          {score}
        </div>
      </div>
    </div>
  );
}

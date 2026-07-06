import {
  formatDownAndDistance,
  formatGameClock,
  formatQuarterLabel,
  type TeamDisplay,
} from "@/lib/gamecast";
import type { PbpPlay } from "@/lib/pbp";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GamecastMode } from "../gamecast-transport-logic";

export interface OperatorHeaderProps {
  homeDisplay: TeamDisplay;
  awayDisplay: TeamDisplay;
  homeScore: number;
  awayScore: number;
  quarter: number | null;
  clockSeconds: number | null;
  isComplete: boolean;
  isPreGame: boolean;
  currentPlay: PbpPlay | null;
  mode: GamecastMode;
  playIndex: number;
  totalPlays: number;
  reducedMotion?: boolean;
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
      {!reducedMotion ? (
        <span
          className="inline-block size-2 rounded-full bg-destructive animate-pulse"
          aria-hidden
        />
      ) : null}
      Live
    </Badge>
  );
}

export default function OperatorHeader({
  homeDisplay,
  awayDisplay,
  homeScore,
  awayScore,
  quarter,
  clockSeconds,
  isComplete,
  isPreGame,
  currentPlay,
  mode,
  playIndex,
  totalPlays,
  reducedMotion = false,
}: OperatorHeaderProps) {
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
  const showSituation = !isPreGame && !isComplete && currentPlay;

  return (
    <div className="flex flex-wrap items-center gap-3 font-mono">
      <span className="text-[15px] font-extrabold tracking-tight text-foreground">
        {homeDisplay.abbr} {homeScore} – {awayScore} {awayDisplay.abbr}
      </span>

      <span
        className={cn(
          "rounded-control border border-border px-2.5 py-1 text-[12px] font-bold",
          isComplete ? "text-accent" : "text-text-muted",
        )}
      >
        {clockLabel ? `${periodLabel} · ${clockLabel}` : periodLabel}
      </span>

      {showSituation && currentPlay ? (
        <span className="text-[13px] font-bold text-foreground">
          {formatDownAndDistance(currentPlay)}
        </span>
      ) : (
        <span className="text-[12px] text-text-subtle">
          {isPreGame ? "Awaiting kickoff" : "Final"}
        </span>
      )}

      <div className="ml-auto">
        <StatusBadge
          mode={mode}
          playIndex={playIndex}
          totalPlays={totalPlays}
          isComplete={isComplete}
          isPreGame={isPreGame}
          reducedMotion={reducedMotion}
        />
      </div>
    </div>
  );
}

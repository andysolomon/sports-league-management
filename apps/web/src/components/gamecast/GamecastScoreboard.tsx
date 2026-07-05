import { formatGameClock, formatQuarterLabel } from "@/lib/gamecast";

export interface GamecastScoreboardProps {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  quarter: number | null;
  clockSeconds: number | null;
  isComplete: boolean;
}

export default function GamecastScoreboard({
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  quarter,
  clockSeconds,
  isComplete,
}: GamecastScoreboardProps) {
  const periodLabel =
    quarter === null
      ? "Pre-game"
      : isComplete
        ? "Final"
        : formatQuarterLabel(quarter);
  const clockLabel =
    clockSeconds !== null && !isComplete
      ? formatGameClock(clockSeconds)
      : null;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-around gap-4 text-center">
        <TeamCol name={homeTeamName} score={homeScore} />
        <div className="shrink-0 text-center">
          <div className="font-mono text-caption-12 uppercase tracking-widest text-text-muted">
            {periodLabel}
          </div>
          {clockLabel ? (
            <div className="mt-1 font-mono text-stat-30 tabular-nums text-foreground">
              {clockLabel}
            </div>
          ) : isComplete ? (
            <div className="mt-1 text-label-14 font-medium text-accent">Final</div>
          ) : null}
        </div>
        <TeamCol name={awayTeamName} score={awayScore} />
      </div>
    </div>
  );
}

function TeamCol({ name, score }: { name: string; score: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-label-14 text-text-muted">{name}</div>
      <div className="font-mono text-stat-30 font-bold tabular-nums text-foreground">
        {score}
      </div>
    </div>
  );
}

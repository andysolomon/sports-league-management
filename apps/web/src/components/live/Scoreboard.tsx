import { Badge } from "@/components/ui/badge";

export interface ScoreboardProps {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  /** Raw status — values include "in_progress" | "halftime" | "final". */
  status: string;
  period: number;
  clock: string | null;
  /** Pre-computed human label shown in the center column when NOT in_progress. */
  statusLabel: string;
}

/*
 * Shared presentational scoreboard used by both the operator console
 * (LiveScoreboard) and the public live card (PublicLiveScore). Keeping the
 * markup in one place stops the two surfaces from drifting apart. Pure
 * presentational — no client hooks — though it renders the Badge primitive.
 */
export function Scoreboard({
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  status,
  period,
  clock,
  statusLabel,
}: ScoreboardProps) {
  return (
    <div className="flex items-center justify-around gap-4 text-center">
      <ScoreCol name={homeTeamName} score={homeScore} />
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {status === "in_progress" ? (
          <Badge variant="success" className="gap-1.5">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
            Live
          </Badge>
        ) : (
          <div className="font-semibold text-foreground">{statusLabel}</div>
        )}
        <div className="mt-1">Period {period}</div>
        {clock ? (
          <div className="mt-1 font-mono tabular-nums">{clock}</div>
        ) : null}
      </div>
      <ScoreCol name={awayTeamName} score={awayScore} />
    </div>
  );
}

function ScoreCol({ name, score }: { name: string; score: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium text-muted-foreground">
        {name}
      </div>
      <div className="font-mono text-5xl font-bold tabular-nums text-foreground">
        {score}
      </div>
    </div>
  );
}

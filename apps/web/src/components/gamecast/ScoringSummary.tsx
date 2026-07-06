import type { ScoringSummaryEntry } from "@/lib/gamecast";
import { formatGameClock, formatQuarterLabel } from "@/lib/gamecast";
import { Badge } from "@/components/ui/badge";

export interface ScoringSummaryTeam {
  id: string;
  abbr: string;
  color: string;
}

export interface ScoringSummaryProps {
  entries: ScoringSummaryEntry[];
  homeTeam: ScoringSummaryTeam;
  awayTeam: ScoringSummaryTeam;
}

function kindBadgeLabel(kind: ScoringSummaryEntry["kind"]): string {
  return kind === "touchdown" ? "TD" : "FG";
}

function kindLabel(kind: ScoringSummaryEntry["kind"]): string {
  return kind === "touchdown" ? "Touchdown" : "Field goal";
}

export default function ScoringSummary({
  entries,
  homeTeam,
  awayTeam,
}: ScoringSummaryProps) {
  const sorted = [...entries].reverse();

  if (sorted.length === 0) {
    return (
      <p className="py-6 text-center text-caption-12 text-text-subtle">
        No scoring yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {sorted.map((entry, index) => {
        const team =
          entry.team === homeTeam.id
            ? homeTeam
            : entry.team === awayTeam.id
              ? awayTeam
              : null;
        const timeLabel = `${formatQuarterLabel(entry.quarter)} ${formatGameClock(entry.clockSeconds)}`;

        return (
          <li
            key={`${entry.quarter}-${entry.clockSeconds}-${entry.kind}-${index}`}
            className="flex items-center gap-3 py-2.5"
          >
            <span className="w-[52px] shrink-0 font-mono text-caption-12 text-text-subtle">
              {timeLabel}
            </span>
            <Badge variant="outline" className="shrink-0 px-1.5 py-0 font-mono text-[10px]">
              {kindBadgeLabel(entry.kind)}
            </Badge>
            {team ? (
              <span
                className="inline-flex items-center gap-1.5 font-mono text-caption-12 font-bold"
                style={{ color: team.color }}
              >
                <span
                  className="inline-block size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: team.color }}
                  aria-hidden
                />
                {team.abbr}
              </span>
            ) : (
              <span className="font-mono text-caption-12 text-text-muted">—</span>
            )}
            <span className="min-w-0 flex-1 truncate text-label-14 text-text-muted">
              {kindLabel(entry.kind)}
            </span>
            <span className="shrink-0 font-mono text-caption-12 text-text-muted">
              +{entry.points}
            </span>
            <span className="shrink-0 font-mono text-label-14 font-bold tabular-nums text-foreground">
              {entry.homeScore}–{entry.awayScore}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

import { cn } from "@/lib/utils";
import type { PlayoffBracketDto, PlayoffMatchupDto } from "@/lib/data-api";
import { groupMatchupsByRound, winnerSide } from "@/lib/playoffs";

function Side({
  seed,
  name,
  score,
  won,
  dim,
}: {
  seed: number | null;
  name: string | null;
  score: number | null;
  won: boolean;
  dim: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-2 py-1 text-sm",
        won && "font-semibold text-foreground",
        dim && !won && "text-muted-foreground",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {seed != null ? (
          <span className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            {seed}
          </span>
        ) : null}
        <span className="truncate">{name ?? "TBD"}</span>
      </span>
      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
        {score ?? ""}
      </span>
    </div>
  );
}

function MatchupCard({ m }: { m: PlayoffMatchupDto }) {
  const side = winnerSide(m);
  const decided = side !== null;
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Side
        seed={m.homeSeed}
        name={m.homeTeamName}
        score={m.homeScore}
        won={side === "home"}
        dim={decided}
      />
      <div className="border-t border-border" />
      <Side
        seed={m.awaySeed}
        name={m.awayTeamName}
        score={m.awayScore}
        won={side === "away"}
        dim={decided}
      />
    </div>
  );
}

/**
 * Read-only single-elimination bracket (WSM-000165). Renders one column per
 * round left→right; columns scroll horizontally on small screens. Winners are
 * bolded, the loser dimmed, and unresolved slots show "TBD".
 */
export default function PlayoffBracket({
  bracket,
}: {
  bracket: PlayoffBracketDto;
}) {
  const rounds = groupMatchupsByRound(bracket.matchups, bracket.rounds);
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-6 pb-2">
        {rounds.map((r) => (
          <div key={r.round} className="flex w-56 shrink-0 flex-col">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {r.label}
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {r.matchups.map((m) => (
                <MatchupCard key={m.id} m={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

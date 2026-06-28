import { cn } from "@/lib/utils";
import type { PlayoffBracketDto, PlayoffMatchupDto } from "@/lib/data-api";
import { bracketSections, winnerSide } from "@/lib/playoffs";

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
  // A first-round bye: a single present team auto-advances with no opponent.
  if (m.isBye) {
    return (
      <div className="overflow-hidden rounded-md border border-dashed border-border bg-card">
        <Side
          seed={m.homeSeed}
          name={m.homeTeamName}
          score={null}
          won={true}
          dim={false}
        />
        <div className="border-t border-border" />
        <div className="px-2 py-1 text-xs italic text-muted-foreground">
          Bye — advances
        </div>
      </div>
    );
  }
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
 * Read-only playoff bracket (WSM-000165, WSM-flex-brackets). Single-elim renders
 * one column per round; double-elim renders three stacked regions (winners
 * bracket, losers bracket, grand final), each as columns. Columns scroll
 * horizontally on small screens. Winners are bolded, losers dimmed, unresolved
 * slots show "TBD", and first-round byes are marked.
 */
export default function PlayoffBracket({
  bracket,
}: {
  bracket: PlayoffBracketDto;
}) {
  const sections = bracketSections(
    bracket.matchups,
    bracket.rounds,
    bracket.format,
  );
  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.type}>
          {section.title ? (
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {section.title}
            </h3>
          ) : null}
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-6 pb-2">
              {section.rounds.map((r) => (
                <div
                  key={`${section.type}-${r.round}`}
                  className="flex w-56 shrink-0 flex-col"
                >
                  <h4 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    {r.label}
                  </h4>
                  <div className="flex flex-1 flex-col justify-around gap-4">
                    {r.matchups.map((m) => (
                      <MatchupCard key={m.id} m={m} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

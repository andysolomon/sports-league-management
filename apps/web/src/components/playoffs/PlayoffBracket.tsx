import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PlayoffBracketDto, PlayoffMatchupDto } from "@/lib/data-api";
import { bracketSections, winnerSide } from "@/lib/playoffs";

function TeamName({
  teamId,
  name,
  won,
  dim,
}: {
  teamId: string | null;
  name: string | null;
  won: boolean;
  dim: boolean;
}) {
  const label = name ?? "TBD";
  const className = cn(
    "truncate hover:underline",
    won && "font-semibold text-foreground",
    dim && !won && "text-muted-foreground",
  );
  if (teamId) {
    return (
      <Link href={`/dashboard/teams/${teamId}`} className={className}>
        {label}
      </Link>
    );
  }
  return <span className={className}>{label}</span>;
}

function Side({
  teamId,
  seed,
  name,
  score,
  won,
  dim,
}: {
  teamId: string | null;
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
        won && "bg-muted/50",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {seed != null ? (
          <span className="shrink-0 rounded bg-muted px-1 font-mono text-caption-12 tabular-nums text-muted-foreground">
            {seed}
          </span>
        ) : null}
        <TeamName teamId={teamId} name={name} won={won} dim={dim} />
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
  const gamecastHref =
    m.fixtureId && m.status === "final" && m.hasPlayLog
      ? `/dashboard/games/${m.fixtureId}/gamecast`
      : null;

  const card = m.isBye ? (
    <div className="overflow-hidden rounded-md border border-dashed border-border bg-card">
      <Side
        teamId={m.homeTeamId}
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
  ) : (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Side
        teamId={m.homeTeamId}
        seed={m.homeSeed}
        name={m.homeTeamName}
        score={m.homeScore}
        won={side === "home"}
        dim={decided}
      />
      <div className="border-t border-border" />
      <Side
        teamId={m.awayTeamId}
        seed={m.awaySeed}
        name={m.awayTeamName}
        score={m.awayScore}
        won={side === "away"}
        dim={decided}
      />
    </div>
  );

  if (gamecastHref) {
    return (
      <Link
        href={gamecastHref}
        className="block rounded-md transition-colors hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="View gamecast"
      >
        {card}
      </Link>
    );
  }

  return card;
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
    <div className="flex flex-col gap-6">
      {bracket.champion ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
          <p className="font-mono text-caption-12 uppercase tracking-wide text-primary">
            Champion
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {bracket.champion.teamId ? (
              <Link
                href={`/dashboard/teams/${bracket.champion.teamId}`}
                className="hover:underline"
              >
                {bracket.champion.teamName ?? "Champion"}
              </Link>
            ) : (
              (bracket.champion.teamName ?? "Champion")
            )}
          </p>
        </div>
      ) : null}

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
                    <h4 className="mb-3 font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
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
    </div>
  );
}

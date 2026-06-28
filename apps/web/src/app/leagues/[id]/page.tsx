import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import type { PlayerDto, TeamDto } from "@sports-management/shared-types";
import {
  playerAttributesV1,
  schedulesStandingsV1,
  statKeepingV1,
} from "@/lib/flags";
import {
  getPlayers,
  getPublicLeagueImportTree,
  getPublicLeagues,
  getPublicLeagueSchedule,
  type PublicScheduleRow,
} from "@/lib/data-api";
import { publicLeagueGuard } from "@/lib/public-league-guard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/*
 * Public league landing page (Phase 3 polish / WSM-000083).
 *
 * NO Clerk session required — middleware whitelists `/leagues/(.*)`.
 * `publicLeagueGuard` 404s if the league isn't opt-in public; the name is read
 * from getPublicLeagues(), which only ever returns public leagues, so private
 * data can't leak even if the guard is bypassed. The Standings and Player
 * Development sections are gated by the SAME flags as the viewers they link to
 * (schedules_standings_v1 / player_attributes_v1), so a fan never sees a card
 * that dead-ends on a flagged-off 404.
 */

// Deduped across generateMetadata + the page render within one request.
const getPublicLeague = cache(async (leagueId: string) => {
  const leagues = await getPublicLeagues();
  return leagues.find((league) => league.id === leagueId) ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const league = await getPublicLeague(id);
  if (!league) return { title: "League" };

  const title = `${league.name} — League`;
  const description = `Standings and player development for ${league.name}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicLeagueLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  await publicLeagueGuard(leagueId);

  const league = await getPublicLeague(leagueId);
  if (!league) notFound();

  const [standingsOn, attributesOn, statsOn] = await Promise.all([
    schedulesStandingsV1(),
    playerAttributesV1(),
    statKeepingV1(),
  ]);

  // Schedule shares the schedules_standings_v1 flag with standings. Surfacing
  // it here is what makes the per-game viewer (WSM-000143) discoverable.
  let schedule: { seasonName: string; rows: PublicScheduleRow[] } | null = null;
  if (standingsOn) {
    schedule = await getPublicLeagueSchedule(leagueId);
  }
  const scheduleRows = (schedule?.rows ?? [])
    .slice()
    .sort((a, b) => {
      const wa = a.fixture.week ?? Number.POSITIVE_INFINITY;
      const wb = b.fixture.week ?? Number.POSITIVE_INFINITY;
      if (wa !== wb) return wa - wb;
      return (a.fixture.scheduledAt ?? "").localeCompare(
        b.fixture.scheduledAt ?? "",
      );
    });
  const hasSchedule = scheduleRows.length > 0;

  // Player development directory — only when the viewer's flag is on. Teams
  // come from the public import tree (no org-access gate), players from the
  // ungated league query; both are safe post-guard since the league is public.
  let teamsWithPlayers: Array<{ team: TeamDto; players: PlayerDto[] }> = [];
  if (attributesOn) {
    const [{ teams }, players] = await Promise.all([
      getPublicLeagueImportTree(leagueId),
      getPlayers([leagueId]),
    ]);
    const playersByTeam = new Map<string, PlayerDto[]>();
    for (const player of players) {
      const list = playersByTeam.get(player.teamId) ?? [];
      list.push(player);
      playersByTeam.set(player.teamId, list);
    }
    teamsWithPlayers = teams
      .map((team) => ({
        team,
        players: (playersByTeam.get(team.id) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }))
      .filter((entry) => entry.players.length > 0)
      .sort((a, b) => a.team.name.localeCompare(b.team.name));
  }

  const hasDevelopment = attributesOn && teamsWithPlayers.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">League</p>
        <h1 className="text-3xl font-bold text-foreground">{league.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore this league&rsquo;s standings and player development.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {standingsOn ? (
          <Link href={`/leagues/${leagueId}/standings`} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>Standings</CardTitle>
                <CardDescription>
                  Season records, points for/against, and rankings.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}

        {statsOn ? (
          <Link href={`/leagues/${leagueId}/stats`} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>Stat leaders</CardTitle>
                <CardDescription>
                  Season passing, rushing, receiving, and defensive leaders.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}

        {hasSchedule ? (
          <a href="#schedule" className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>
                  Fixtures and final scores for {schedule?.seasonName}.
                </CardDescription>
              </CardHeader>
            </Card>
          </a>
        ) : null}

        {hasDevelopment ? (
          <a href="#player-development" className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>Player Development</CardTitle>
                <CardDescription>
                  Season-over-season attribute growth, by player.
                </CardDescription>
              </CardHeader>
            </Card>
          </a>
        ) : null}
      </div>

      {hasSchedule ? (
        <section id="schedule" className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Schedule
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {scheduleRows.map(({ fixture, result }) => (
              <li key={fixture.id}>
                <Link
                  href={`/leagues/${leagueId}/games/${fixture.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {fixture.homeTeamName} vs {fixture.awayTeamName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fixture.week !== null ? `Week ${fixture.week}` : "TBD"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {fixture.status === "final" && result !== null
                      ? `${result.homeScore} – ${result.awayScore}`
                      : fixture.status === "cancelled"
                        ? "Cancelled"
                        : "Scheduled"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasDevelopment ? (
        <section id="player-development" className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Player Development
          </h2>
          <div className="space-y-6">
            {teamsWithPlayers.map(({ team, players }) => (
              <Card key={team.id}>
                <CardHeader>
                  <CardTitle className="text-base">{team.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-wrap gap-2">
                    {players.map((player) => (
                      <li key={player.id}>
                        <Link
                          href={`/leagues/${leagueId}/players/${player.id}/development`}
                          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          {player.name}
                          <span className="font-mono text-xs text-muted-foreground">
                            {player.position}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {!standingsOn && !hasSchedule && !hasDevelopment ? (
        <p className="text-sm text-muted-foreground">
          Public viewers for this league aren&rsquo;t available yet.
        </p>
      ) : null}
    </div>
  );
}

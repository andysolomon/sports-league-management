import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getSeasons,
  getLeagues,
  listFixturesBySeason,
  computeStandings,
  getPlayoffBracket,
  getTeamsByLeague,
  getTeamRosterLimitStatus,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import {
  teamsBelowTargetRoster,
  type UndersizedTeam,
} from "@/lib/offseason-activate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Calendar, Trophy } from "lucide-react";
import { formatDate } from "@/lib/format";
import { isChampionDecided } from "@/lib/dynasty";
import {
  formatSeasonRecord,
  sortSeasons,
  type SeasonArchiveMeta,
} from "@/lib/season-list";
import { CreateSeasonButton, SeasonRowActions } from "./season-actions";
import { PageHeader } from "../_components/page-header";

async function fetchSeasonArchive(seasonId: string): Promise<SeasonArchiveMeta> {
  const [fixtures, standings, bracket] = await Promise.all([
    listFixturesBySeason(seasonId).catch(() => []),
    computeStandings(seasonId).catch(() => []),
    getPlayoffBracket(seasonId).catch(() => null),
  ]);

  const gamesTotal = fixtures.length;
  const gamesFinal = fixtures.filter((f) => f.status === "final").length;
  const leaderRow =
    gamesFinal > 0
      ? (standings.find((s) => s.leagueRank === 1) ?? standings[0])
      : null;

  return {
    gamesFinal,
    gamesTotal,
    championDecided: isChampionDecided(bracket),
    leader: leaderRow
      ? {
          teamName: leaderRow.teamName,
          wins: leaderRow.wins,
          losses: leaderRow.losses,
          ties: leaderRow.ties,
        }
      : null,
    champion: bracket?.champion ?? null,
  };
}

function SeasonArchiveSummary({ archive }: { archive: SeasonArchiveMeta | undefined }) {
  if (!archive || archive.gamesTotal === 0) {
    return <p className="text-xs text-muted-foreground">No games yet</p>;
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      <span>
        {archive.gamesFinal} / {archive.gamesTotal} games
      </span>
      {archive.leader ? (
        <>
          <span aria-hidden="true">&middot;</span>
          <span>
            {archive.leader.teamName}{" "}
            <span className="font-mono">
              (
              {formatSeasonRecord(
                archive.leader.wins,
                archive.leader.losses,
                archive.leader.ties,
              )}
              )
            </span>
          </span>
        </>
      ) : null}
      {archive.champion ? (
        <>
          <span aria-hidden="true">&middot;</span>
          <span className="inline-flex items-center gap-1 text-foreground/80">
            <Trophy
              className="h-3 w-3 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>{archive.champion.teamName ?? "Champion"}</span>
          </span>
        </>
      ) : null}
    </p>
  );
}

async function fetchUndersizedTeamsForSeason(
  seasonId: string,
  leagueId: string,
  orgContext: Awaited<ReturnType<typeof resolveOrgContext>>,
): Promise<UndersizedTeam[]> {
  const teams = await getTeamsByLeague(leagueId, orgContext).catch(() => []);
  const rosterSizes = await Promise.all(
    teams.map(async (team) => {
      const status = await getTeamRosterLimitStatus(seasonId, team.id).catch(
        () => ({ activeCount: 0 }),
      );
      return {
        id: team.id,
        name: team.name,
        activeCount: status.activeCount,
      };
    }),
  );
  return teamsBelowTargetRoster(rosterSizes);
}

export default async function SeasonsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const ids = orgContext.visibleLeagueIds;
  const [seasons, leagues] = await Promise.all([
    getSeasons(ids),
    getLeagues(ids),
  ]);

  const seasonArchives = new Map(
    await Promise.all(
      seasons.map(
        async (season) =>
          [season.id, await fetchSeasonArchive(season.id)] as const,
      ),
    ),
  );

  const undersizedBySeason = new Map(
    await Promise.all(
      seasons
        .filter((season) => season.status === "upcoming")
        .map(async (season) => {
          const undersized = await fetchUndersizedTeamsForSeason(
            season.id,
            season.leagueId,
            orgContext,
          );
          return [season.id, undersized] as const;
        }),
    ),
  );

  const seasonsByLeague = new Map<string, typeof seasons>();
  for (const season of seasons) {
    const existing = seasonsByLeague.get(season.leagueId) ?? [];
    existing.push(season);
    seasonsByLeague.set(season.leagueId, existing);
  }

  return (
    <div>
      <PageHeader title="Seasons" description="Seasons and their schedules across your leagues." />

      {leagues.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No leagues yet"
          description="Create a league first, then add a season to unlock rosters, schedules, and player attributes."
        />
      ) : (
        <div className="space-y-6">
          {leagues.map((league) => {
            const leagueSeasons = sortSeasons(seasonsByLeague.get(league.id) ?? []);
            return (
              <Card key={league.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Trophy className="h-5 w-5 shrink-0 text-primary" />
                      <CardTitle className="truncate">{league.name}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">
                        {leagueSeasons.length} season
                        {leagueSeasons.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <CreateSeasonButton leagueId={league.id} />
                  </div>
                </CardHeader>
                <CardContent>
                  {leagueSeasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No seasons yet. Create one to enable rosters, schedules,
                      and attributes.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {leagueSeasons.map((season) => (
                        <li
                          key={season.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-1 py-4"
                          data-testid="season-row"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-3">
                              <Link
                                href={`/dashboard/seasons/${season.id}`}
                                className="font-medium text-foreground hover:text-primary hover:underline"
                              >
                                {season.name}
                              </Link>
                              <StatusBadge status={season.status} />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(season.startDate)} &ndash;{" "}
                                {formatDate(season.endDate)}
                              </span>
                            </div>
                            <SeasonArchiveSummary
                              archive={seasonArchives.get(season.id)}
                            />
                          </div>
                          <SeasonRowActions
                            season={season}
                            championDecided={
                              seasonArchives.get(season.id)?.championDecided ??
                              false
                            }
                            undersizedTeams={undersizedBySeason.get(season.id) ?? []}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

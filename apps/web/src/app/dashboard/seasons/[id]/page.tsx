import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Trophy } from "lucide-react";
import {
  schedulesStandingsV1,
  playoffsV1,
  statKeepingV1,
} from "@/lib/flags";
import {
  computeStandings,
  getLeague,
  getPlayoffBracket,
  getPlayers,
  getSeason,
  getSeasons,
  getTeamsByLeague,
  listFixturesBySeason,
  listFreeAgents,
  getDraft,
} from "@/lib/data-api";
import { canManageTeam } from "@/lib/authorization";
import { resolveOrgContext, requireOrgAdmin, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import { OffseasonHub } from "@/components/offseason/OffseasonHub";
import { summarizeClassDistribution } from "@/lib/class-year";
import {
  dynastySeasonState,
  evaluateStartNextSeason,
  seasonDecidedContext,
} from "@/lib/dynasty-panel";
import { DynastyPanel } from "@/components/dynasty/DynastyPanel";
import { regularSeasonProgress } from "@/lib/playoffs";
import { resolveLifecycleSeason } from "@/lib/season-view";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";
import {
  buildSeasonSiblingLinks,
  leagueHomeHref,
  seasonHomeHref,
} from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

/**
 * Season hub (WSM-000213): one home per season. Progress, standings snapshot,
 * champion when decided, and season-scoped links into schedule / standings /
 * playoffs / stats (canonical Season-owned routes, WSM-000214 / #575).
 */
export default async function SeasonHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: seasonId } = await params;
  const orgContext = await resolveOrgContext(userId);
  // getSeason enforces league visibility; treat both "missing" and "not
  // visible" as 404 so the route doesn't leak season existence.
  const season = await getSeason(seasonId, orgContext).catch(() => null);
  if (!season) notFound();

  const league = await getLeague(season.leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  let isAdmin = false;
  if (league.orgId) {
    try {
      await requireOrgAdmin(league.orgId, userId);
      isAdmin = true;
    } catch {
      // Not admin — read-only view
    }
  }

  const seasons = await getSeasons([league.id]).catch(() => []);
  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const upcomingSeason = seasons.find((s) => s.status === "upcoming") ?? null;
  const completedSeason = resolveLifecycleSeason(
    seasons.filter((s) => s.status === "completed"),
  );

  const [fixtures, standings, bracket, scheduleEnabled, playoffsEnabled, statsEnabled, dynastyFixtures, dynastyBracket, leaguePlayers, teams] =
    await Promise.all([
      listFixturesBySeason(season.id),
      computeStandings(season.id),
      getPlayoffBracket(season.id),
      schedulesStandingsV1(),
      playoffsV1(),
      statKeepingV1(),
      activeSeason
        ? listFixturesBySeason(activeSeason.id).catch(() => [])
        : Promise.resolve([]),
      activeSeason
        ? getPlayoffBracket(activeSeason.id).catch(() => null)
        : Promise.resolve(null),
      isAdmin && league.orgId
        ? getPlayers([league.id]).catch(() => [])
        : Promise.resolve([]),
      isAdmin && league.orgId
        ? getTeamsByLeague(league.id, orgContext).catch(() => [])
        : Promise.resolve([]),
    ]);

  const decidedCtx = activeSeason
    ? seasonDecidedContext(dynastyFixtures, dynastyBracket)
    : {
        seasonDecided: false,
        unplayedGames: 0,
        playoffsUndecided: false,
      };
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const graduatedPlayers =
    isAdmin && league.orgId
      ? leaguePlayers
          .filter((p) => p.status === "graduated")
          .map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            teamName: teamNameById.get(p.teamId) ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
  const dynastySeasonStateLine = dynastySeasonState({
    activeSeason: activeSeason ? { name: activeSeason.name } : null,
    upcomingSeason: upcomingSeason ? { name: upcomingSeason.name } : null,
    seasonDecided: decidedCtx.seasonDecided,
  });
  const startNextSeasonGate = evaluateStartNextSeason({
    activeSeason: activeSeason
      ? { id: activeSeason.id, name: activeSeason.name }
      : null,
    completedSeason: completedSeason
      ? { id: completedSeason.id, name: completedSeason.name }
      : null,
    upcomingSeason: upcomingSeason
      ? { id: upcomingSeason.id, name: upcomingSeason.name }
      : null,
    ...decidedCtx,
  });

  const progress = regularSeasonProgress(fixtures);
  const playoffFixtures = fixtures.filter((f) => f.stage === "playoff");
  const playoffPlayed = playoffFixtures.filter(
    (f) => f.status === "final",
  ).length;
  const champion = bracket?.champion ?? null;
  const topFive = standings.slice(0, 5);

  const isUpcomingSeason = season.status === "upcoming";
  let freeAgents: Awaited<ReturnType<typeof listFreeAgents>> = [];
  let offseasonTeams: Awaited<ReturnType<typeof getTeamsByLeague>> = [];
  let offseasonOrgRole: Awaited<ReturnType<typeof resolveOrgRole>> | null =
    null;
  let draft: Awaited<ReturnType<typeof getDraft>> = null;
  let playerNames: Record<string, string> = {};

  if (isUpcomingSeason) {
    [freeAgents, offseasonTeams, offseasonOrgRole, draft] = await Promise.all([
      listFreeAgents(league.id).catch(() => []),
      getTeamsByLeague(league.id, orgContext).catch(() => []),
      league.orgId
        ? resolveOrgRole(league.orgId, userId).catch(() => null)
        : Promise.resolve(null),
      getDraft(season.id).catch(() => null),
    ]);

    const leaguePlayers = await getPlayers([league.id]).catch(() => []);
    playerNames = Object.fromEntries(
      leaguePlayers.map((player) => [player.id, player.name]),
    );
  }

  let manageableTeams: { id: string; name: string }[] = [];
  if (isUpcomingSeason && offseasonTeams.length > 0) {
    const checks = await Promise.all(
      offseasonTeams.map(async (team) => ({
        id: team.id,
        name: team.name,
        canManage: await canManageTeam(team.id, userId),
      })),
    );
    manageableTeams = checks
      .filter((entry) => entry.canManage)
      .map((entry) => ({ id: entry.id, name: entry.name }));
  }
  const offseasonIsAdmin = canManageOrgSettings(offseasonOrgRole);
  const canSignFreeAgents = manageableTeams.length > 0;
  const coachTeam =
    !offseasonIsAdmin && manageableTeams.length === 1
      ? manageableTeams[0]
      : null;
  const signTeams = offseasonIsAdmin
    ? offseasonTeams.map((team) => ({ id: team.id, name: team.name }))
    : manageableTeams;

  const links = buildLeagueSeasonNavLinks({
    leagueId: league.id,
    seasonId: season.id,
    scheduleEnabled,
    playoffsEnabled,
    statsEnabled,
  });

  return (
    <div className="mx-auto max-w-[960px] space-y-4">
      <ResourceHeader
        kind="season"
        name={season.name}
        href={seasonHomeHref(season.id)}
        subtitle={`Season overview · ${league.name}`}
        status={<StatusBadge status={season.status} />}
        context={
          <>
            <Link
              href={leagueHomeHref(league.id)}
              className="text-accent hover:underline"
            >
              {league.name}
            </Link>
            {" · "}
            {formatDate(season.startDate)} &ndash; {formatDate(season.endDate)}
          </>
        }
        siblings={buildSeasonSiblingLinks({
          seasonId: season.id,
          scheduleEnabled,
          playoffsEnabled,
          statsEnabled,
        })}
      />
      <WorkspaceNav links={links} />

      {isUpcomingSeason && (
        <OffseasonHub
          leagueId={league.id}
          seasonId={season.id}
          seasonName={season.name}
          agents={freeAgents}
          teams={signTeams}
          canSign={canSignFreeAgents}
          isAdmin={offseasonIsAdmin}
          coachTeam={coachTeam}
          draft={draft}
          playerNames={playerNames}
        />
      )}

      {champion && (
        <Card className="mb-6 border-primary/40">
          <CardContent className="flex items-center gap-3 p-5">
            <Trophy className="h-6 w-6 text-primary" aria-hidden />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Champion
              </p>
              <p className="text-lg font-semibold text-foreground">
                {champion.teamName ? (
                  <Link
                    href={`/dashboard/teams/${champion.teamId}`}
                    className="hover:underline"
                  >
                    {champion.teamName}
                  </Link>
                ) : (
                  "Decided"
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Season progress</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.total === 0 && playoffFixtures.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Calendar
                  className="h-6 w-6 text-muted-foreground"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  No games scheduled yet.
                </p>
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Regular season</dt>
                  <dd className="font-mono tabular-nums text-foreground">
                    {progress.final} / {progress.total} played
                  </dd>
                </div>
                {playoffFixtures.length > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Playoff games</dt>
                    <dd className="font-mono tabular-nums text-foreground">
                      {playoffPlayed} / {playoffFixtures.length} played
                    </dd>
                  </div>
                )}
                {season.playoffTeams ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Playoff format</dt>
                    <dd className="text-foreground">
                      {season.playoffTeams} teams
                      {season.playoffFormat
                        ? ` · ${season.playoffFormat} elimination`
                        : ""}
                    </dd>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Playoffs</dt>
                    <dd className="text-foreground">Not configured</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
          </CardHeader>
          <CardContent>
            {topFive.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No recorded results yet.
              </p>
            ) : (
              <ol className="space-y-2 text-sm">
                {topFive.map((s, i) => (
                  <li
                    key={s.teamId}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <Link
                        href={`/dashboard/teams/${s.teamId}`}
                        className="truncate text-foreground hover:underline"
                      >
                        {s.teamName}
                      </Link>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      {s.wins}&ndash;{s.losses}
                      {s.ties > 0 ? `–${s.ties}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {scheduleEnabled && standings.length > 0 && (
              <Link
                href={`/dashboard/seasons/${season.id}/standings`}
                className="mt-4 inline-block text-sm text-primary hover:underline"
              >
                Full standings &rarr;
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin && league.orgId && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <DynastyPanel
              leagueId={league.id}
              seasonState={dynastySeasonStateLine}
              gate={startNextSeasonGate}
              classDistribution={summarizeClassDistribution(leaguePlayers)}
              graduatedPlayers={graduatedPlayers}
              upcomingSeason={
                upcomingSeason
                  ? { id: upcomingSeason.id, name: upcomingSeason.name }
                  : null
              }
              unplayedGames={decidedCtx.unplayedGames}
              playoffsUndecided={decidedCtx.playoffsUndecided}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

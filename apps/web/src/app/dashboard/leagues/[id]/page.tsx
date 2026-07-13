import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, Settings2 } from "lucide-react";
import {
  getLeague,
  getSeasons,
  listFixturesBySeason,
  getPlayoffBracket,
  getPlayers,
  getTeamsByLeague,
  computeStandings,
} from "@/lib/data-api";
import { summarizeClassDistribution } from "@/lib/class-year";
import {
  dynastySeasonState,
  evaluateStartNextSeason,
  seasonDecidedContext,
} from "@/lib/dynasty-panel";
import { DynastyPanel } from "@/components/dynasty/DynastyPanel";
import { resolveLifecycleSeason } from "@/lib/season-view";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import {
  schedulesStandingsV1,
  playoffsV1,
  statKeepingV1,
} from "@/lib/flags";
import { regularSeasonProgress } from "@/lib/playoffs";
import { resolvePlayoffHandoff } from "@/lib/playoff-handoff";
import { resolveLeagueLifecycleBanner } from "@/lib/league-lifecycle-banners";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";
import { LeagueLifecycleBanners } from "@/components/league/LeagueLifecycleBanners";
import { LeagueCurrentSeasonCard } from "@/components/league/LeagueCurrentSeasonCard";
import { LeagueStandingsCard } from "@/components/league/LeagueStandingsCard";
import { LeagueTeamsGrid } from "@/components/league/LeagueTeamsGrid";

/**
 * League info destination (WSM-000254): read-oriented league home with
 * current-season context, standings snapshot, teams grid, and lifecycle banners.
 * Admin settings live at `/manage`.
 */
export default async function LeagueInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(id, orgContext).catch(() => null);
  if (!league) notFound();

  let isAdmin = false;
  if (league.orgId) {
    try {
      await requireOrgAdmin(league.orgId, userId);
      isAdmin = true;
    } catch {
      // Not admin — read-only info view
    }
  }

  const [seasons, teams, scheduleEnabled, playoffsEnabled, statsEnabled] =
    await Promise.all([
      getSeasons([id]).catch(() => []),
      getTeamsByLeague(id, orgContext).catch(() => []),
      schedulesStandingsV1(),
      playoffsV1(),
      statKeepingV1(),
    ]);

  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const upcomingSeason = seasons.find((s) => s.status === "upcoming") ?? null;
  const completedSeason = resolveLifecycleSeason(
    seasons.filter((s) => s.status === "completed"),
  );
  const decidedSeason = resolveLifecycleSeason(seasons);

  const [fixtures, bracket, standings, leaguePlayers] = await Promise.all([
    activeSeason
      ? listFixturesBySeason(activeSeason.id).catch(() => [])
      : Promise.resolve([]),
    activeSeason
      ? getPlayoffBracket(activeSeason.id).catch(() => null)
      : Promise.resolve(null),
    activeSeason
      ? computeStandings(activeSeason.id).catch(() => [])
      : Promise.resolve([]),
    isAdmin && league.orgId
      ? getPlayers([id]).catch(() => [])
      : Promise.resolve([]),
  ]);

  const progress = regularSeasonProgress(fixtures);
  const handoff = resolvePlayoffHandoff({
    playoffsEnabled,
    viewedSeasonId: activeSeason?.id ?? null,
    viewedSeasonStatus: activeSeason?.status ?? null,
    decidedSeasonId: decidedSeason?.id ?? null,
    playoffTeams: activeSeason?.playoffTeams,
    regularTotal: progress.total,
    regularComplete: progress.complete,
    bracketExists: bracket !== null,
    canManage: isAdmin,
  });
  const lifecycleBanner = resolveLeagueLifecycleBanner({
    champion: bracket?.champion ?? null,
    seasonName: activeSeason?.name ?? null,
    handoff,
    progressFinal: progress.final,
    progressTotal: progress.total,
  });

  const decidedCtx = activeSeason
    ? seasonDecidedContext(fixtures, bracket)
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

  const recordByTeamId = new Map(
    standings.map((row) => [
      row.teamId,
      { wins: row.wins, losses: row.losses, ties: row.ties },
    ]),
  );

  const seasonQuery = activeSeason ? `?season=${activeSeason.id}` : "";
  const seasonNavLinks = buildLeagueSeasonNavLinks({
    leagueId: id,
    seasonId: activeSeason?.id ?? null,
    scheduleEnabled,
    playoffsEnabled,
    statsEnabled,
  });
  const fullStandingsHref =
    scheduleEnabled && activeSeason
      ? `/dashboard/leagues/${id}/standings${seasonQuery}`
      : null;

  const contextParts = [
    `${teams.length} team${teams.length === 1 ? "" : "s"}`,
    `${seasons.length} season${seasons.length === 1 ? "" : "s"}`,
  ];

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leagues", href: "/dashboard/leagues" },
          { label: league.name },
        ]}
      />
      <WorkspaceHeader
        title={league.name}
        status={
          league.orgId ? (
            <Badge variant="secondary" className="shrink-0">
              Organization
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              Public
            </Badge>
          )
        }
        sub={contextParts.join(" · ")}
        actions={
          <>
            {isAdmin && league.orgId ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/leagues/${id}/manage`}>
                  <Settings2 className="h-4 w-4" aria-hidden />
                  Manage
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/seasons">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Seasons
              </Link>
            </Button>
          </>
        }
      />

      {lifecycleBanner && activeSeason ? (
        <LeagueLifecycleBanners
          banner={lifecycleBanner}
          leagueId={id}
          seasonId={activeSeason.id}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <LeagueCurrentSeasonCard
          season={
            activeSeason
              ? {
                  id: activeSeason.id,
                  name: activeSeason.name,
                  status: activeSeason.status,
                  playoffTeams: activeSeason.playoffTeams,
                  playoffFormat: activeSeason.playoffFormat,
                }
              : null
          }
          progress={progress}
          navLinks={seasonNavLinks}
        />
        <LeagueStandingsCard
          standings={standings}
          fullStandingsHref={fullStandingsHref}
        />
      </div>

      <div className="mt-6">
        <LeagueTeamsGrid
          teams={teams}
          standings={standings}
          standingsHref={fullStandingsHref}
          recordByTeamId={recordByTeamId}
        />
      </div>

      {isAdmin && league.orgId && activeSeason ? (
        <Card className="mt-6" data-testid="league-dynasty-panel">
          <CardContent className="pt-6">
            <DynastyPanel
              leagueId={id}
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
      ) : null}
    </div>
  );
}

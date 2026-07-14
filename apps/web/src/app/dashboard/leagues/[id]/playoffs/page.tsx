import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { playoffsV1, schedulesStandingsV1, statKeepingV1 } from "@/lib/flags";
import {
  getLeague,
  getLeagueOrgId,
  getSeasons,
  getPlayoffBracket,
  getTeamsByLeague,
  listFixturesBySeason,
} from "@/lib/data-api";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import { playoffPagePhase, regularSeasonProgress } from "@/lib/playoffs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PlayoffBracket from "@/components/playoffs/PlayoffBracket";
import PlayoffRoundControls from "@/components/playoffs/PlayoffRoundControls";
import AdvanceToPlayoffsButton from "@/components/playoffs/AdvanceToPlayoffsButton";
import SeasonSwitcher from "@/components/schedule/SeasonSwitcher";
import { resolveViewedSeason } from "@/lib/season-view";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";
import { BackLink } from "@/components/workspace/BackLink";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";

export default async function LeaguePlayoffsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const enabled = await playoffsV1();
  if (!enabled) notFound();

  const scheduleEnabled = await schedulesStandingsV1();
  const statsEnabled = await statKeepingV1();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: leagueId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) notFound();

  const orgId = await getLeagueOrgId(leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  const isAdmin = canManageRoster(role);

  const { season: seasonParam } = await searchParams;
  const allSeasons = await getSeasons([leagueId]);
  const activeSeason = resolveViewedSeason(allSeasons, seasonParam);

  // Completed seasons are read-only history (WSM-000238/239): never render
  // an advance control — the action would reject it server-side anyway.
  const seasonCompleted = activeSeason?.status === "completed";

  const fixtures = activeSeason
    ? await listFixturesBySeason(activeSeason.id)
    : [];
  const progress = regularSeasonProgress(fixtures);

  const bracket = activeSeason
    ? await getPlayoffBracket(activeSeason.id)
    : null;

  // Visual polish (WSM-000250): TeamMark brand colors for bracket cards.
  const teams = bracket
    ? await getTeamsByLeague(leagueId, orgContext).catch(() => [])
    : [];
  const teamColors = Object.fromEntries(
    teams.map((team) => [team.id, team.primaryColor ?? null]),
  );

  const phase = activeSeason
    ? playoffPagePhase({
        playoffTeams: activeSeason.playoffTeams,
        bracketExists: bracket !== null,
        regularComplete: progress.complete,
      })
    : null;

  const peerNavLinks = buildLeagueSeasonNavLinks({
    leagueId,
    seasonId: activeSeason?.id ?? null,
    scheduleEnabled,
    playoffsEnabled: enabled,
    statsEnabled,
    exclude: "playoffs",
  });

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leagues", href: "/dashboard/leagues" },
          { label: league.name, href: `/dashboard/leagues/${leagueId}` },
          { label: "Playoffs" },
        ]}
      />
      <BackLink
        href={`/dashboard/leagues/${leagueId}`}
        label="Back to League"
      />
      <WorkspaceHeader
        title={league.name}
        size="sub-hub"
        sub={`Playoffs${activeSeason ? ` · ${activeSeason.name}` : ""}`}
        actions={
          activeSeason ? (
            <SeasonSwitcher
              seasons={allSeasons.map((s) => ({
                id: s.id,
                name: s.name,
                status: s.status,
              }))}
              currentSeasonId={activeSeason.id}
            />
          ) : null
        }
      />
      <WorkspaceNav links={peerNavLinks} />

      {!activeSeason ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Playoffs need a season. Create one and play some games so standings
              can seed the bracket.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/seasons">Go to Seasons</Link>
            </Button>
          </CardContent>
        </Card>
      ) : phase === "no_playoffs_config" ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {activeSeason.name} is not configured for playoffs. Set a playoff team
            count on the season to enable the bracket.
          </CardContent>
        </Card>
      ) : phase === "invalid_playoff_size" ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {activeSeason.name} uses a legacy playoff size ({activeSeason.playoffTeams}{" "}
            teams). New brackets require 4, 8, or 16 teams — update the season
            settings before starting playoffs.
          </CardContent>
        </Card>
      ) : phase === "bracket_live" && bracket ? (
        <div className="flex flex-col gap-4">
          {!seasonCompleted ? (
            <PlayoffRoundControls
              leagueId={leagueId}
              seasonId={activeSeason.id}
              bracket={bracket}
              canManage={isAdmin}
            />
          ) : null}
          <PlayoffBracket bracket={bracket} teamColors={teamColors} />
        </div>
      ) : phase === "ready" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <Trophy className="h-8 w-8 text-accent" aria-hidden="true" />
            <p className="max-w-md text-sm text-muted-foreground">
              Regular season complete ({progress.final} of {progress.total} games
              final). Ready to seed the bracket from current standings.
            </p>
            {isAdmin && !seasonCompleted ? (
              <AdvanceToPlayoffsButton
                leagueId={leagueId}
                seasonId={activeSeason.id}
              />
            ) : seasonCompleted ? (
              <p className="text-xs text-muted-foreground">
                This season is completed — playoffs can no longer be started.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Waiting for a league manager to advance to playoffs.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Regular season in progress — {progress.final} of {progress.total}{" "}
              games final. Finish the schedule to seed the bracket.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isAdmin && !seasonCompleted ? (
                <AdvanceToPlayoffsButton
                  leagueId={leagueId}
                  seasonId={activeSeason.id}
                  disabled
                />
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/leagues/${leagueId}/schedule`}>
                  Go to schedule
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

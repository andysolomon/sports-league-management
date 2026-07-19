import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { playoffsV1, schedulesStandingsV1, statKeepingV1 } from "@/lib/flags";
import {
  getLeague,
  getLeagueOrgId,
  getSeason,
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
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  leagueHomeHref,
  seasonHomeHref,
  seasonSubpageHref,
} from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function SeasonPlayoffsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await playoffsV1();
  if (!enabled) notFound();

  const scheduleEnabled = await schedulesStandingsV1();
  const statsEnabled = await statKeepingV1();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: seasonId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const season = await getSeason(seasonId, orgContext).catch(() => null);
  if (!season) notFound();

  const league = await getLeague(season.leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const orgId = await getLeagueOrgId(league.id);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  const isAdmin = canManageRoster(role);

  const allSeasons = await getSeasons([league.id]);

  const seasonCompleted = season.status === "completed";

  const fixtures = await listFixturesBySeason(season.id);
  const progress = regularSeasonProgress(fixtures);

  const bracket = await getPlayoffBracket(season.id);

  const teams = bracket
    ? await getTeamsByLeague(league.id, orgContext).catch(() => [])
    : [];
  const teamColors = Object.fromEntries(
    teams.map((team) => [team.id, team.primaryColor ?? null]),
  );

  const phase = playoffPagePhase({
    playoffTeams: season.playoffTeams,
    bracketExists: bracket !== null,
    regularComplete: progress.complete,
  });

  const peerNavLinks = buildLeagueSeasonNavLinks({
    leagueId: league.id,
    seasonId: season.id,
    scheduleEnabled,
    playoffsEnabled: enabled,
    statsEnabled,
    exclude: "playoffs",
  });

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="season"
        name={season.name}
        href={seasonHomeHref(seasonId)}
        subtitle={`Playoffs · ${league.name}`}
        context={
          <a
            href={leagueHomeHref(league.id)}
            className="text-accent hover:underline"
          >
            {league.name}
          </a>
        }
        actions={
          <SeasonSwitcher
            seasons={allSeasons.map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
            }))}
            currentSeasonId={season.id}
          />
        }
      />
      <WorkspaceNav links={peerNavLinks} />

      {phase === "no_playoffs_config" ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {season.name} is not configured for playoffs. Set a playoff team
            count on the season to enable the bracket.
          </CardContent>
        </Card>
      ) : phase === "invalid_playoff_size" ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {season.name} uses a legacy playoff size ({season.playoffTeams}{" "}
            teams). New brackets require 4, 8, or 16 teams — update the season
            settings before starting playoffs.
          </CardContent>
        </Card>
      ) : phase === "bracket_live" && bracket ? (
        <div className="flex flex-col gap-4">
          {!seasonCompleted ? (
            <PlayoffRoundControls
              leagueId={league.id}
              seasonId={season.id}
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
                leagueId={league.id}
                seasonId={season.id}
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
                  leagueId={league.id}
                  seasonId={season.id}
                  disabled
                />
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link href={seasonSubpageHref(season.id, "schedule")}>
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

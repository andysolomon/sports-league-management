import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { schedulesStandingsV1, playoffsV1, statKeepingV1 } from "@/lib/flags";
import {
  computeStandings,
  computeDivisionStandings,
  getDivisions,
  getLeague,
  getSeason,
  getSeasons,
  getTeamsByLeague,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StandingsTable from "@/components/schedule/StandingsTable";
import SeasonSwitcher from "@/components/schedule/SeasonSwitcher";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  leagueHomeHref,
  seasonHomeHref,
} from "@/components/workspace/resource-navigation";
import { trackStandingsView } from "@/lib/analytics";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function SeasonStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await schedulesStandingsV1();
  if (!enabled) notFound();

  const playoffsEnabled = await playoffsV1();
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

  const allSeasons = await getSeasons([league.id]);

  const standings = await computeStandings(season.id);
  const divisions = await getDivisions([league.id]);

  const teams = await getTeamsByLeague(league.id, orgContext).catch(() => []);
  const teamColors = Object.fromEntries(
    teams.map((team) => [team.id, team.primaryColor ?? null]),
  );
  const playoffCut = season.playoffTeams ?? 0;

  const divisionStandings =
    divisions.length > 0
      ? await Promise.all(
          divisions.map(async (division) => ({
            division,
            rows: await computeDivisionStandings(season.id, division.id),
          })),
        )
      : [];

  void trackStandingsView({ leagueId: league.id, route: "dashboard" });

  const peerNavLinks = buildLeagueSeasonNavLinks({
    leagueId: league.id,
    seasonId: season.id,
    scheduleEnabled: enabled,
    playoffsEnabled,
    statsEnabled,
    exclude: "standings",
  });

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="season"
        name={season.name}
        href={seasonHomeHref(seasonId)}
        subtitle={`Standings · ${league.name}`}
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

      <Card>
        <CardHeader>
          <CardTitle>Season standings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {standings.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No teams or no recorded results yet for {season.name}.
            </p>
          ) : divisionStandings.length > 0 ? (
            <div className="divide-y divide-border">
              {divisionStandings.map(({ division, rows }) =>
                rows.length > 0 ? (
                  <StandingsTable
                    key={division.id}
                    divisionName={division.name}
                    rows={rows}
                    playoffCut={playoffCut}
                    withTeamMarks
                    teamColors={teamColors}
                  />
                ) : null,
              )}
            </div>
          ) : (
            <StandingsTable
              rows={standings}
              playoffCut={playoffCut}
              showPlayoffCutDivider
              withTeamMarks
              teamColors={teamColors}
            />
          )}
        </CardContent>
      </Card>

      {divisions.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Division ranks are computed across {divisions.length}{" "}
          {divisions.length === 1 ? "division" : "divisions"} in this league.
        </p>
      ) : null}
    </div>
  );
}

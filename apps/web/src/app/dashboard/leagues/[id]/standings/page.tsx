import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { schedulesStandingsV1, playoffsV1, statKeepingV1 } from "@/lib/flags";
import {
  computeStandings,
  computeDivisionStandings,
  getDivisions,
  getLeague,
  getSeasons,
  getTeamsByLeague,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StandingsTable from "@/components/schedule/StandingsTable";
import SeasonSwitcher from "@/components/schedule/SeasonSwitcher";
import { resolveViewedSeason } from "@/lib/season-view";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import { leagueHomeHref } from "@/components/workspace/resource-navigation";
import { trackStandingsView } from "@/lib/analytics";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function LeagueStandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const enabled = await schedulesStandingsV1();
  if (!enabled) notFound();

  const playoffsEnabled = await playoffsV1();
  const statsEnabled = await statKeepingV1();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: leagueId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const { season: seasonParam } = await searchParams;
  const allSeasons = await getSeasons([leagueId]);
  const activeSeason = resolveViewedSeason(allSeasons, seasonParam);

  if (!activeSeason) {
    return (
      <div className="space-y-4">
        <ResourceHeader
          kind="league"
          name={league.name}
          href={leagueHomeHref(leagueId)}
          subtitle="Standings"
        />
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No seasons in this league yet — standings unavailable.
          </CardContent>
        </Card>
      </div>
    );
  }

  const standings = await computeStandings(activeSeason.id);
  const divisions = await getDivisions([leagueId]);

  // Visual polish (WSM-000250): TeamMark brand colors + the playoff-cut
  // treatment. The cut divider only renders on the flat league-ranked table;
  // division tables (division-rank ordered) show Clinched badges alone.
  const teams = await getTeamsByLeague(leagueId, orgContext).catch(() => []);
  const teamColors = Object.fromEntries(
    teams.map((team) => [team.id, team.primaryColor ?? null]),
  );
  const playoffCut = activeSeason.playoffTeams ?? 0;

  const divisionStandings =
    divisions.length > 0
      ? await Promise.all(
          divisions.map(async (division) => ({
            division,
            rows: await computeDivisionStandings(activeSeason.id, division.id),
          })),
        )
      : [];

  void trackStandingsView({ leagueId, route: "dashboard" });

  const peerNavLinks = buildLeagueSeasonNavLinks({
    leagueId,
    seasonId: activeSeason.id,
    scheduleEnabled: enabled,
    playoffsEnabled,
    statsEnabled,
    exclude: "standings",
  });

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="league"
        name={league.name}
        href={leagueHomeHref(leagueId)}
        subtitle={`Standings · ${activeSeason.name}`}
        actions={
          <SeasonSwitcher
            seasons={allSeasons.map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
            }))}
            currentSeasonId={activeSeason.id}
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
              No teams or no recorded results yet for {activeSeason.name}.
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

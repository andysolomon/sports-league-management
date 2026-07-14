import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  computeDivisionStandings,
  getDivisions,
  getLeagueOrgId,
  getSeasons,
  getTeams,
  listResultsBySeason,
} from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { getUserRoleInOrg } from "@/lib/org-context";
import { schedulesStandingsV1 } from "@/lib/flags";
import { DivisionsTable } from "./divisions-table";
import { PageHeader } from "../_components/page-header";

export default async function DivisionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { activeLeagueId } = await resolveActiveLeague(userId);
  const ids = activeLeagueId ? [activeLeagueId] : [];

  const [divisions, teams, seasons, standingsEnabled] = await Promise.all([
    getDivisions(ids),
    getTeams(ids),
    activeLeagueId ? getSeasons(ids) : Promise.resolve([]),
    schedulesStandingsV1(),
  ]);

  const orgId = activeLeagueId ? await getLeagueOrgId(activeLeagueId) : null;
  const role = orgId ? await getUserRoleInOrg(orgId, userId) : null;
  const isAdmin = role === "org:admin";

  const activeSeason =
    seasons.find((season) => season.status === "active") ?? seasons[0] ?? null;

  const teamColors = Object.fromEntries(
    teams.map((team) => [team.id, team.primaryColor]),
  );

  let hasPlayedGames = false;
  const divisionPanels = await Promise.all(
    divisions.map(async (division) => {
      if (!activeSeason) {
        const divisionTeams = teams.filter((team) => team.divisionId === division.id);
        return {
          id: division.id,
          name: division.name,
          teamColors,
          rows: divisionTeams.map((team, index) => ({
            teamId: team.id,
            teamName: team.name,
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            divisionRank: index + 1,
            leagueRank: index + 1,
          })),
        };
      }

      const rows = await computeDivisionStandings(activeSeason.id, division.id);
      return {
        id: division.id,
        name: division.name,
        teamColors,
        rows,
      };
    }),
  );

  if (activeSeason) {
    const results = await listResultsBySeason(activeSeason.id).catch(() => []);
    hasPlayedGames = results.length > 0;
  }

  const standingsHref =
    standingsEnabled && activeLeagueId && activeSeason
      ? `/dashboard/leagues/${activeLeagueId}/standings?season=${activeSeason.id}`
      : null;

  return (
    <div>
      <PageHeader
        title="Divisions"
        description={`${divisions.length} division${divisions.length === 1 ? "" : "s"}${activeSeason ? ` · ${activeSeason.name}` : ""}`}
      />
      <DivisionsTable
        divisions={divisionPanels}
        isAdmin={isAdmin}
        activeLeagueId={activeLeagueId}
        activeSeasonName={activeSeason?.name ?? null}
        hasPlayedGames={hasPlayedGames}
        standingsHref={standingsHref}
      />
    </div>
  );
}

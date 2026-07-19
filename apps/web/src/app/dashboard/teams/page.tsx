import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { PlayerDto, Standing, TeamDto } from "@sports-management/shared-types";
import {
  computeDivisionStandings,
  computeStandings,
  getDivisions,
  getLeagueOrgId,
  getPlayers,
  getSeasons,
  getTeamAttributeSnapshots,
  getTeamMaddenOveralls,
  getTeamRosterLimitStatus,
  getTeams,
  listFixturesBySeason,
  listResultsBySeason,
} from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { getUserRoleInOrg, resolveOrgContext } from "@/lib/org-context";
import { playerAttributesV1, schedulesStandingsV1 } from "@/lib/flags";
import { DEFAULT_TARGET_ROSTER_SIZE } from "@/lib/offseason-activate";
import {
  computeTeamOvr,
  divisionTeamCount,
  formLast5,
  mergeStandingsWithTeams,
  pickKeyPlayers,
  resultsMapFromSeasonLines,
} from "@/lib/teams-table";
import type { TeamsTableRow } from "./teams-table";
import type { TeamDetailSheetData } from "./team-detail-sheet";
import { TeamsView } from "./teams-view";
import type { DivisionPanel } from "../divisions/divisions-table";
import { teamsHomeView } from "./teams-home-navigation";

function groupPlayersByTeam(players: PlayerDto[]): Map<string, PlayerDto[]> {
  const map = new Map<string, PlayerDto[]>();
  for (const player of players) {
    const list = map.get(player.teamId) ?? [];
    list.push(player);
    map.set(player.teamId, list);
  }
  return map;
}

async function buildTeamsPageData(input: {
  teams: TeamDto[];
  standings: Standing[];
  seasonId: string;
  divisionNameById: Map<string, string>;
  playersByTeam: Map<string, PlayerDto[]>;
  attributesEnabled: boolean;
  orgContext: Awaited<ReturnType<typeof resolveOrgContext>>;
  fixtures: Awaited<ReturnType<typeof listFixturesBySeason>>;
  results: Awaited<ReturnType<typeof listResultsBySeason>>;
}) {
  const resultsByFixtureId = resultsMapFromSeasonLines(input.results);
  const mergedStandings = mergeStandingsWithTeams(input.standings, input.teams);
  const teamById = new Map(input.teams.map((team) => [team.id, team]));

  const rosterStatuses = await Promise.all(
    input.teams.map(async (team) => {
      const status = await getTeamRosterLimitStatus(
        input.seasonId,
        team.id,
      ).catch(() => ({
        activeCount: 0,
        rosterLimit: team.rosterLimit,
        remaining: null,
      }));
      return {
        teamId: team.id,
        activeCount: status.activeCount,
        rosterLimit:
          status.rosterLimit ?? team.rosterLimit ?? DEFAULT_TARGET_ROSTER_SIZE,
      };
    }),
  );
  const rosterByTeamId = new Map(
    rosterStatuses.map((status) => [status.teamId, status]),
  );

  const ratingBundles = input.attributesEnabled
    ? await Promise.all(
        input.teams.map(async (team) => {
          const [snapshots, madden] = await Promise.all([
            getTeamAttributeSnapshots(team.id, input.orgContext).catch(
              () => new Map(),
            ),
            getTeamMaddenOveralls(team.id, input.orgContext).catch(
              () => new Map<string, number>(),
            ),
          ]);
          return { teamId: team.id, snapshots, madden };
        }),
      )
    : [];

  const ratingsByTeamId = new Map(
    ratingBundles.map((bundle) => [bundle.teamId, bundle]),
  );

  const rows: TeamsTableRow[] = [];
  const sheetDataByTeamId: Record<string, TeamDetailSheetData> = {};

  for (const standing of mergedStandings) {
    const team = teamById.get(standing.teamId);
    if (!team) continue;

    const roster = rosterByTeamId.get(team.id) ?? {
      activeCount: 0,
      rosterLimit: team.rosterLimit ?? DEFAULT_TARGET_ROSTER_SIZE,
    };
    const divisionName = input.divisionNameById.get(team.divisionId) ?? null;
    const ratings = ratingsByTeamId.get(team.id);
    const teamPlayers = input.playersByTeam.get(team.id) ?? [];

    rows.push({
      team,
      standing,
      divisionName,
      rosterCount: roster.activeCount,
      rosterLimit: roster.rosterLimit,
    });

    sheetDataByTeamId[team.id] = {
      team,
      standing,
      divisionName,
      divisionRank: standing.divisionRank,
      divisionTeamCount: divisionTeamCount(
        mergedStandings,
        team.divisionId,
        input.teams,
      ),
      rosterCount: roster.activeCount,
      rosterLimit: roster.rosterLimit,
      form: formLast5(input.fixtures, resultsByFixtureId, team.id),
      ovr: ratings
        ? computeTeamOvr(ratings.snapshots, ratings.madden)
        : null,
      keyPlayers: ratings
        ? pickKeyPlayers(teamPlayers, ratings.snapshots, ratings.madden)
        : pickKeyPlayers(teamPlayers, new Map(), new Map()),
    };
  }

  return { rows, sheetDataByTeamId };
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    division?: string | string[];
  }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { activeLeagueId } = await resolveActiveLeague(userId);
  const leagueScope = activeLeagueId ? [activeLeagueId] : [];
  const orgContext = await resolveOrgContext(userId);

  const [teams, seasons, divisions, players, scheduleLinksEnabled, attributesEnabled] =
    await Promise.all([
      getTeams(leagueScope),
      getSeasons(leagueScope),
      getDivisions(leagueScope),
      getPlayers(leagueScope),
      schedulesStandingsV1(),
      playerAttributesV1(),
    ]);
  const params = await searchParams;
  const currentView = teamsHomeView(params.view);
  const requestedDivisionId = Array.isArray(params.division)
    ? params.division[0]
    : params.division;
  const selectedDivisionId =
    currentView === "divisions" &&
    divisions.some((division) => division.id === requestedDivisionId)
      ? requestedDivisionId ?? null
      : null;

  const activeSeason =
    seasons.find((season) => season.status.toLowerCase() === "active") ?? null;
  const divisionNameById = new Map(
    divisions.map((division) => [division.id, division.name]),
  );
  const playersByTeam = groupPlayersByTeam(players);

  let rows: TeamsTableRow[] = [];
  let sheetDataByTeamId: Record<string, TeamDetailSheetData> = {};

  if (activeSeason) {
    const [standings, fixtures, results] = await Promise.all([
      computeStandings(activeSeason.id).catch(() => [] as Standing[]),
      listFixturesBySeason(activeSeason.id).catch(() => []),
      listResultsBySeason(activeSeason.id).catch(() => []),
    ]);

    const built = await buildTeamsPageData({
      teams,
      standings,
      seasonId: activeSeason.id,
      divisionNameById,
      playersByTeam,
      attributesEnabled,
      orgContext,
      fixtures,
      results,
    });
    rows = built.rows;
    sheetDataByTeamId = built.sheetDataByTeamId;
  }

  const divisionSeason =
    seasons.find((season) => season.status === "active") ?? seasons[0] ?? null;
  let divisionPanels: DivisionPanel[] = [];
  let isAdmin = false;
  let hasPlayedGames = false;
  let standingsHref: string | null = null;

  if (currentView === "divisions") {
    const orgId = activeLeagueId ? await getLeagueOrgId(activeLeagueId) : null;
    const role = orgId ? await getUserRoleInOrg(orgId, userId) : null;
    const teamColors = Object.fromEntries(
      teams.map((team) => [team.id, team.primaryColor]),
    );
    divisionPanels = await Promise.all(
      divisions.map(async (division) => {
        if (!divisionSeason) {
          const divisionTeams = teams.filter(
            (team) => team.divisionId === division.id,
          );
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

        return {
          id: division.id,
          name: division.name,
          teamColors,
          rows: await computeDivisionStandings(divisionSeason.id, division.id),
        };
      }),
    );
    hasPlayedGames = divisionSeason
      ? (await listResultsBySeason(divisionSeason.id).catch(() => [])).length > 0
      : false;
    standingsHref =
      scheduleLinksEnabled && activeLeagueId && divisionSeason
        ? `/dashboard/seasons/${divisionSeason.id}/standings`
        : null;
    isAdmin = role === "org:admin";
  }

  return (
    <TeamsView
      teamCount={teams.length}
      seasonName={activeSeason?.name ?? null}
      rows={rows}
      sheetDataByTeamId={sheetDataByTeamId}
      leagueId={activeLeagueId}
      scheduleLinksEnabled={scheduleLinksEnabled}
      hasActiveSeason={activeSeason != null}
      currentView={currentView}
      divisions={divisionPanels}
      isAdmin={isAdmin}
      activeSeasonName={divisionSeason?.name ?? null}
      hasPlayedGames={hasPlayedGames}
      standingsHref={standingsHref}
      selectedDivisionId={selectedDivisionId}
    />
  );
}

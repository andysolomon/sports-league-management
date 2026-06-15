import { LeagueImportSchema } from "@sports-management/api-contracts";
import { ensureLocalWorkspace } from "./local-workspace";
import type { WorkspaceDataProvider } from "./workspace-provider";

/** The validated nested import payload (same shape the server importer accepts). */
export type LeagueImportPayload = ReturnType<(typeof LeagueImportSchema)["parse"]>;

export interface LocalImportResult {
  created: { divisions: number; teams: number; players: number };
}

/**
 * Seed the browser-local workspace from a validated `LeagueImportPayload` — the
 * SAME shape `csvToLeagueImport` (#248) produces and the server importer accepts
 * (RFC §9). Instead of POSTing to `/api/cli/import`, it writes into the local
 * provider, so one payload shape serves server import, local seed, and (Slice 6)
 * local→server migration.
 *
 * Merge semantics mirror the server importer: matched by name and reused.
 * Divisions and teams dedupe by name within the single local league; players
 * dedupe by name within a team. A player that can't be created (e.g. a strict
 * jersey-policy conflict) is skipped rather than aborting the whole import.
 */
export async function importLeagueIntoLocal(
  provider: WorkspaceDataProvider,
  payload: LeagueImportPayload,
): Promise<LocalImportResult> {
  const league = await ensureLocalWorkspace(provider);

  const divByName = new Map(
    (await provider.listDivisions(league.id)).map((d) => [d.name, d]),
  );
  const teamByName = new Map(
    (await provider.listTeams(league.id)).map((t) => [t.name, t]),
  );

  let divisions = 0;
  let teams = 0;
  let players = 0;

  for (const div of payload.divisions) {
    let division = divByName.get(div.name);
    if (!division) {
      division = await provider.createDivision({
        name: div.name,
        leagueId: league.id,
      });
      divByName.set(div.name, division);
      divisions += 1;
    }

    for (const team of div.teams) {
      let teamDto = teamByName.get(team.name);
      if (!teamDto) {
        teamDto = await provider.createTeam({
          name: team.name,
          leagueId: league.id,
          city: team.city,
          stadium: team.stadium,
        });
        teamByName.set(team.name, teamDto);
        teams += 1;
      }
      // Place the team in its division and refresh its details (idempotent).
      await provider.updateTeam(teamDto.id, {
        divisionId: division.id,
        city: team.city,
        stadium: team.stadium,
        logoUrl: team.logoUrl ?? null,
      });

      const existingNames = new Set(
        (await provider.listPlayersByTeam(teamDto.id)).map((p) => p.name),
      );
      for (const player of team.players) {
        if (existingNames.has(player.name)) continue;
        try {
          await provider.createPlayer({
            name: player.name,
            teamId: teamDto.id,
            position: player.position,
            jerseyNumber: player.jerseyNumber ?? null,
            dateOfBirth: player.dateOfBirth ?? null,
            status: player.status ?? "Active",
          });
          existingNames.add(player.name);
          players += 1;
        } catch {
          // Skip a player that can't be created; don't abort the import.
        }
      }
    }
  }

  return { created: { divisions, teams, players } };
}

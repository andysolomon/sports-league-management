import Dexie, { type Table } from "dexie";
import type {
  DepthChartEntryDto,
  DivisionDto,
  FixtureDto,
  GameResultDto,
  LeagueDto,
  PlayerDto,
  SeasonDto,
  TeamDto,
} from "@sports-management/shared-types";

/**
 * Browser-local workspace store for the free no-login tier (WSM-000137, #258).
 *
 * One IndexedDB database holds a single coach's private workspace — the
 * local-capable entity set from the RFC (§3): leagues, divisions, teams,
 * players, seasons, schedule (fixtures + results), depth chart. Account-only
 * concepts (orgs, members, public viewer, Discover forks) have no store here;
 * their absence is what keeps the local boundary honest.
 *
 * Records are stored as the same DTO shapes the rest of the app uses, keyed by a
 * client-generated UUID string `id` (so a local record is shape-compatible with
 * a server DTO and migrates cleanly — see RFC §8). Secondary indexes cover the
 * foreign keys the UI filters by.
 *
 * The full store set is declared at v1 even though Slice 1 only writes
 * leagues/divisions/teams/players — this avoids a schema migration when the
 * later slices (seasons, schedule, standings) light up.
 */
export class WsmLocalDb extends Dexie {
  leagues!: Table<LeagueDto, string>;
  divisions!: Table<DivisionDto, string>;
  teams!: Table<TeamDto, string>;
  players!: Table<PlayerDto, string>;
  seasons!: Table<SeasonDto, string>;
  fixtures!: Table<FixtureDto, string>;
  gameResults!: Table<GameResultDto, string>;
  depthChart!: Table<DepthChartEntryDto, string>;

  constructor(name = "wsm-local") {
    super(name);
    // First field is the primary key (`id`, client-generated — NOT auto-inc);
    // the rest are secondary indexes on the foreign keys we query by.
    this.version(1).stores({
      leagues: "id, name",
      divisions: "id, leagueId, conferenceId",
      teams: "id, leagueId, divisionId",
      players: "id, teamId, leagueId",
      seasons: "id, leagueId",
      fixtures: "id, seasonId, homeTeamId, awayTeamId",
      gameResults: "id, fixtureId",
      depthChart: "id, teamId, seasonId, playerId",
    });
  }
}

/**
 * Process-wide singleton handle to the local DB. Lazily constructed so importing
 * this module never touches IndexedDB (e.g. on the server, where it's absent).
 * Tests pass their own name/instance for isolation.
 */
let dbSingleton: WsmLocalDb | null = null;

export function getLocalDb(): WsmLocalDb {
  if (!dbSingleton) dbSingleton = new WsmLocalDb();
  return dbSingleton;
}

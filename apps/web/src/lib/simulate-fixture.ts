import type { FixtureDto } from "@sports-management/shared-types";
import {
  bulkUpsertPlayerGameStats,
  recordGameResult,
  upsertGamePlayLog,
  upsertPlayerGameStats,
} from "@/lib/data-api";
import {
  buildTeamSimProfile,
  type TeamSimProfileCache,
} from "@/lib/build-team-sim-profile";
import type { OrgContext } from "@/lib/org-context";
import {
  deriveStatLines,
  PBP_ENGINE_VERSION,
  simulateGameLog,
} from "@/lib/pbp";
import { seedFromString, simulateScore } from "@/lib/simulate-game";
import {
  DEFAULT_SIMULATION_FLAVOR,
  type SimulationFlavor,
} from "@/lib/simulation-flavor";

export interface SimulateFixtureInput {
  fixture: FixtureDto;
  orgContext: OrgContext;
  actorUserId: string;
  decisive?: boolean;
  profileCache: TeamSimProfileCache;
  /** When true, stat lines are written in one bulk mutation (season sims). */
  bulkStats?: boolean;
  /** Season simulation flavor (defaults to balanced). */
  simulationFlavor?: SimulationFlavor;
}

export interface SimulateFixtureResult {
  homeScore: number;
  awayScore: number;
  /** True when either team had no roster players — score-only fallback. */
  usedScoreFallback: boolean;
}

function knownPlayerIds(
  homePlayers: { playerId: string }[],
  awayPlayers: { playerId: string }[],
): Set<string> {
  return new Set([
    ...homePlayers.map((p) => p.playerId),
    ...awayPlayers.map((p) => p.playerId),
  ]);
}

/**
 * Run PBP sim (or score fallback), persist the log + stat lines, and record
 * the final score. Playoff bracket advancement stays in recordGameResult.
 */
export async function simulateAndPersistFixture(
  input: SimulateFixtureInput,
): Promise<SimulateFixtureResult> {
  const { fixture, orgContext, actorUserId, profileCache } = input;
  const decisive = input.decisive ?? fixture.stage === "playoff";
  const flavor = input.simulationFlavor ?? DEFAULT_SIMULATION_FLAVOR;
  const seed = seedFromString(fixture.id);

  const [home, away] = await Promise.all([
    buildTeamSimProfile(fixture.homeTeamId, fixture.seasonId, orgContext, profileCache),
    buildTeamSimProfile(fixture.awayTeamId, fixture.seasonId, orgContext, profileCache),
  ]);

  const rosterEmpty = home.players.length === 0 || away.players.length === 0;

  if (rosterEmpty) {
    const { homeScore, awayScore } = simulateScore({
      homeStrength: home.strength,
      awayStrength: away.strength,
      seed,
      decisive,
      flavor,
    });
    await recordGameResult({
      fixtureId: fixture.id,
      homeScore,
      awayScore,
      actorUserId,
    });
    return { homeScore, awayScore, usedScoreFallback: true };
  }

  const log = simulateGameLog({ home, away, seed, decisive, flavor });
  const homeScore = log.homeScore;
  const awayScore = log.awayScore;

  await upsertGamePlayLog({
    fixtureId: fixture.id,
    seasonId: fixture.seasonId,
    logJson: JSON.stringify(log),
    engineVersion: PBP_ENGINE_VERSION,
    actorUserId,
  });

  const rosterIds = knownPlayerIds(home.players, away.players);
  const statLines = deriveStatLines(log).filter((line) =>
    rosterIds.has(line.playerId),
  );

  if (statLines.length > 0) {
    if (input.bulkStats) {
      await bulkUpsertPlayerGameStats({
        fixtureId: fixture.id,
        seasonId: fixture.seasonId,
        actorUserId,
        lines: statLines.map((line) => ({
          playerId: line.playerId,
          teamId: line.teamId,
          statsJson: JSON.stringify(line.statLine),
        })),
      });
    } else {
      await Promise.all(
        statLines.map((line) =>
          upsertPlayerGameStats({
            fixtureId: fixture.id,
            seasonId: fixture.seasonId,
            playerId: line.playerId,
            teamId: line.teamId,
            stats: line.statLine,
            actorUserId,
          }),
        ),
      );
    }
  }

  await recordGameResult({
    fixtureId: fixture.id,
    homeScore,
    awayScore,
    actorUserId,
  });

  return { homeScore, awayScore, usedScoreFallback: false };
}

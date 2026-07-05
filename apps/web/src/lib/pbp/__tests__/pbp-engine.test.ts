import { describe, it, expect } from "vitest";
import { PlayerGameStatLineSchema } from "@sports-management/api-contracts";
import {
  simulateGameLog,
  deriveStatLines,
  allPlays,
  sumTeamStatGroup,
  type PbpGameInput,
  type TeamSimProfile,
  type PlayerSimProfile,
} from "../index";

function makePlayer(
  teamId: string,
  position: string,
  overall: number,
  depthRank: number,
  slot?: string,
): PlayerSimProfile {
  return {
    playerId: `${teamId}-${position}-${depthRank}`,
    position,
    overall,
    depthRank,
    positionSlot: slot ?? position,
  };
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const base = strength;
  const specs: Array<[string, number, string?]> = [
    ["QB", 2],
    ["RB", 3],
    ["WR", 5],
    ["TE", 2],
    ["DE", 2],
    ["DT", 2],
    ["OLB", 2],
    ["MLB", 2],
    ["CB", 3],
    ["S", 2],
    ["K", 1],
    ["P", 1],
  ];
  const players: PlayerSimProfile[] = [];
  for (const [pos, count] of specs) {
    for (let i = 1; i <= count; i++) {
      const jitter = ((i * 7 + base) % 11) - 5;
      players.push(
        makePlayer(teamId, pos, clamp(base + jitter, 40, 99), i, pos),
      );
    }
  }
  return players;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildTeam(teamId: string, strength: number): TeamSimProfile {
  return {
    teamId,
    strength,
    players: buildRoster(teamId, strength),
  };
}

function defaultInput(
  overrides: Partial<PbpGameInput> & { seed: number },
): PbpGameInput {
  return {
    home: buildTeam("home", 68),
    away: buildTeam("away", 62),
    decisive: false,
    ...overrides,
  };
}

function scoreFromPlays(log: ReturnType<typeof simulateGameLog>): {
  home: number;
  away: number;
} {
  let home = 0;
  let away = 0;
  for (const play of allPlays(log)) {
    if (!play.isScoring) continue;
    if (play.offenseTeamId === log.homeTeamId) home += play.pointsScored;
    else if (play.offenseTeamId === log.awayTeamId) away += play.pointsScored;
  }
  return { home, away };
}

describe("pbp engine invariants", () => {
  it("1. same seed => identical log and derived stat lines", () => {
    const input = defaultInput({ seed: 4242 });
    const a = simulateGameLog(input);
    const b = simulateGameLog(input);
    expect(a).toEqual(b);
    expect(deriveStatLines(a)).toEqual(deriveStatLines(b));
  });

  it("2. final score equals sum of scoring plays", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const log = simulateGameLog(defaultInput({ seed }));
      const fromPlays = scoreFromPlays(log);
      expect(fromPlays.home).toBe(log.homeScore);
      expect(fromPlays.away).toBe(log.awayScore);
    }
  });

  it("3. stat/score TD and kicking consistency", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const log = simulateGameLog(defaultInput({ seed }));
      const lines = deriveStatLines(log);
      for (const teamId of [log.homeTeamId, log.awayTeamId]) {
        const rushTd = sumTeamStatGroup(lines, teamId, "rushing", "td");
        const passTd = sumTeamStatGroup(lines, teamId, "passing", "td");
        const tdPlays = allPlays(log).filter(
          (p) =>
            p.isScoring &&
            p.pointsScored === 6 &&
            p.offenseTeamId === teamId,
        ).length;
        expect(passTd + rushTd).toBe(tdPlays);

        const fgMade = sumTeamStatGroup(lines, teamId, "kicking", "fgMade");
        const fgPlays = allPlays(log).filter(
          (p) => p.playType === "field_goal" && p.offenseTeamId === teamId,
        ).length;
        expect(fgMade).toBe(fgPlays);

        const xpMade = sumTeamStatGroup(lines, teamId, "kicking", "xpMade");
        const xpPlays = allPlays(log).filter(
          (p) => p.playType === "extra_point" && p.offenseTeamId === teamId,
        ).length;
        expect(xpMade).toBe(xpPlays);
      }
    }
  });

  it("4. team totals equal player sums and lines validate against schema", () => {
    const log = simulateGameLog(defaultInput({ seed: 9001 }));
    const lines = deriveStatLines(log);
    for (const { statLine } of lines) {
      expect(PlayerGameStatLineSchema.safeParse(statLine).success).toBe(true);
    }

    const fields: Array<[keyof typeof lines[0]["statLine"], string]> = [
      ["passing", "yards"],
      ["rushing", "yards"],
      ["receiving", "yards"],
      ["defense", "tacklesSolo"],
      ["kicking", "fgMade"],
    ];
    for (const teamId of [log.homeTeamId, log.awayTeamId]) {
      for (const [group, field] of fields) {
        const teamTotal = sumTeamStatGroup(lines, teamId, group, field);
        const playerSum = lines
          .filter((l) => l.teamId === teamId)
          .reduce((s, l) => {
            const g = l.statLine[group] as Record<string, number> | undefined;
            return s + (g?.[field] ?? 0);
          }, 0);
        expect(playerSum).toBe(teamTotal);
      }
    }
  });

  it("5. decisive never ties; non-decisive ties are possible", () => {
    for (let seed = 0; seed < 120; seed++) {
      const log = simulateGameLog(defaultInput({ seed, decisive: true }));
      expect(log.homeScore).not.toBe(log.awayScore);
    }

    let foundTie = false;
    for (let seed = 0; seed < 5000 && !foundTie; seed++) {
      const log = simulateGameLog(
        defaultInput({
          seed,
          home: buildTeam("home", 55),
          away: buildTeam("away", 55),
        }),
      );
      if (log.homeScore === log.awayScore) foundTie = true;
    }
    expect(foundTie).toBe(true);
  });

  it("6. clock/quarter monotonicity and drive possession alternation", () => {
    const log = simulateGameLog(defaultInput({ seed: 31415 }));
    const plays = allPlays(log);
    let lastQuarter = 1;
    let lastClock = 720;
    for (const play of plays) {
      if (play.quarter > lastQuarter) {
        lastQuarter = play.quarter;
        lastClock = 720;
      }
      expect(play.clockSeconds).toBeLessThanOrEqual(lastClock);
      lastClock = play.clockSeconds;
    }

    const scrimmageDrives = log.drives.filter(
      (d) => d.plays.some((p) => p.playType !== "kickoff"),
    );
    for (let i = 1; i < scrimmageDrives.length; i++) {
      const prev = scrimmageDrives[i - 1];
      const curr = scrimmageDrives[i];
      const prevEndedWithScore =
        prev.endReason === "touchdown" || prev.endReason === "field_goal";
      const prevTurnover = prev.endReason === "turnover";
      const prevPeriodEnd =
        prev.endReason === "end_of_half" || prev.endReason === "end_of_game";
      if (
        !prevEndedWithScore &&
        !prevTurnover &&
        prev.endReason !== "missed_field_goal" &&
        !prevPeriodEnd
      ) {
        expect(curr.teamId).not.toBe(prev.teamId);
      }
    }
  });

  it("7. serialized log stays under 300KB", () => {
    for (let seed = 0; seed < 20; seed++) {
      const log = simulateGameLog(defaultInput({ seed }));
      expect(JSON.stringify(log).length).toBeLessThan(300_000);
    }
  });

  it("8. distribution sanity across 100+ seeded games", () => {
    const totals: number[] = [];
    let strongWins = 0;
    const N = 120;
    for (let seed = 0; seed < N; seed++) {
      const log = simulateGameLog(
        defaultInput({
          seed: seed * 9973 + 11,
          home: buildTeam("home", 78),
          away: buildTeam("away", 52),
        }),
      );
      totals.push(log.homeScore + log.awayScore);
      if (log.homeScore > log.awayScore) strongWins++;
    }
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    expect(mean).toBeGreaterThanOrEqual(30);
    expect(mean).toBeLessThanOrEqual(60);
    expect(strongWins / N).toBeGreaterThan(0.6);
  });
});

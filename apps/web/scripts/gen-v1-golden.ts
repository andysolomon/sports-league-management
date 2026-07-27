/*
 * One-shot generator for the v1 golden-log fixture (Dynasty Mode A1).
 *
 * Run against the UNMODIFIED v1 engine, before any v2 work, to capture what the
 * engine produced for a set of fixed seeds. Every later Epic A slice asserts it
 * still reproduces this byte-for-byte with v2 features disabled — that is the
 * guard against silently changing how existing leagues simulate.
 *
 *   pnpm --filter @sports-management/web exec tsx scripts/gen-v1-golden.ts
 *
 * Kept in the repo so the fixture is reproducible rather than a mystery blob.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { simulateGameLog } from "../src/lib/pbp/engine";
import type {
  PbpGameInput,
  PlayerSimProfile,
  TeamSimProfile,
} from "../src/lib/pbp/types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
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
      const jitter = ((i * 7 + strength) % 11) - 5;
      players.push({
        playerId: `${teamId}-${pos}-${i}`,
        position: pos,
        overall: clamp(strength + jitter, 40, 99),
        depthRank: i,
        positionSlot: pos,
      });
    }
  }
  return players;
}

function buildTeam(teamId: string, strength: number): TeamSimProfile {
  return { teamId, strength, players: buildRoster(teamId, strength) };
}

// A deliberate spread: an even matchup, a mismatch, a playoff game that cannot
// tie, and each simulation flavor — so the fixture pins more than one code path.
const CASES: Array<{ name: string; input: PbpGameInput }> = [
  {
    name: "even-balanced",
    input: {
      home: buildTeam("home", 70),
      away: buildTeam("away", 70),
      seed: 123456,
      flavor: "balanced",
    },
  },
  {
    name: "mismatch-chalk",
    input: {
      home: buildTeam("home", 85),
      away: buildTeam("away", 55),
      seed: 987654,
      flavor: "chalk",
    },
  },
  {
    name: "upsets-flavor",
    input: {
      home: buildTeam("home", 60),
      away: buildTeam("away", 75),
      seed: 246810,
      flavor: "upsets",
    },
  },
  {
    name: "decisive-playoff",
    input: {
      home: buildTeam("home", 68),
      away: buildTeam("away", 68),
      seed: 555001,
      decisive: true,
      flavor: "balanced",
    },
  },
];

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/*
 * Storing a SHA-256 per case proves byte-for-byte identity at a fraction of the
 * size (four full logs is ~470KB of JSON in git). The FIRST case additionally
 * keeps its full log so a failure has a readable deep-equal diff rather than
 * just "hash mismatch" — regenerate and diff locally for the others.
 */
const fixture = {
  engineVersion: "1.0.0",
  note:
    "Captured from the v1 engine before Epic A. Every A slice must reproduce " +
    "these logs byte-for-byte with v2 features disabled. Regenerate with " +
    "scripts/gen-v1-golden.ts ONLY when a v1 behavior change is intended.",
  cases: CASES.map((c, index) => {
    const log = simulateGameLog(c.input);
    return {
      name: c.name,
      seed: c.input.seed,
      decisive: c.input.decisive ?? false,
      flavor: c.input.flavor ?? "balanced",
      homeStrength: c.input.home.strength,
      awayStrength: c.input.away.strength,
      homeScore: log.homeScore,
      awayScore: log.awayScore,
      driveCount: log.drives.length,
      playCount: log.drives.reduce((n, d) => n + d.plays.length, 0),
      sha256: digest(log),
      // Only the first case carries its full log — see note above.
      log: index === 0 ? log : undefined,
    };
  }),
};

const out = new URL(
  "../src/lib/pbp/__tests__/fixtures/v1-golden-logs.json",
  import.meta.url,
);
writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`wrote ${CASES.length} cases to ${out.pathname}`);
for (const c of fixture.cases) {
  console.log(
    `  ${c.name}: ${c.homeScore}-${c.awayScore}, ${c.driveCount} drives, ` +
      `${c.playCount} plays, sha=${c.sha256.slice(0, 12)}`,
  );
}

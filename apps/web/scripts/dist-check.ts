/*
 * Simulation distribution report — the instrument behind issue #642.
 *
 * Run it after ANY change to the tuning constants in `src/lib/pbp/engine.ts`:
 *
 *   pnpm --filter @sports-management/web exec tsx scripts/dist-check.ts
 *
 * Both sides use an identical 70-strength roster, so every asymmetry in the
 * output is the engine's own rather than the harness's.
 *
 * The v1 row is a PIN, not a target. Already-simulated fixtures must stay
 * reproducible, so v1 is frozen and the corrections live behind gates — if that
 * row moves, golden parity broke.
 */
import { simulateGameLog } from "../src/lib/pbp/engine";
import type {
  PbpFeatureGates,
  PlayerSimProfile,
  TeamSimProfile,
} from "../src/lib/pbp/types";

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function roster(t: string, s: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 2], ["RB", 3], ["WR", 5], ["TE", 2], ["DE", 2], ["DT", 2],
    ["OLB", 2], ["MLB", 2], ["CB", 3], ["S", 2], ["K", 1], ["P", 1],
  ];
  const out: PlayerSimProfile[] = [];
  for (const [p, c] of specs) {
    for (let i = 1; i <= c; i++) {
      const j = ((i * 7 + s) % 11) - 5;
      out.push({
        playerId: `${t}-${p}-${i}`,
        position: p,
        overall: clamp(s + j, 40, 99),
        depthRank: i,
        positionSlot: p,
      });
    }
  }
  return out;
}

const team = (t: string, s: number): TeamSimProfile => ({
  teamId: t,
  strength: s,
  players: roster(t, s),
});

const GAMES = 300;

function report(label: string, features: PbpFeatureGates | undefined): void {
  let homeWins = 0;
  let awayWins = 0;
  let ties = 0;
  let homePoints = 0;
  let awayPoints = 0;
  let shutouts = 0;
  let scrimmagePlays = 0;

  for (let i = 0; i < GAMES; i++) {
    const log = simulateGameLog({
      home: team("home", 70),
      away: team("away", 70),
      seed: 1000 + i,
      flavor: "balanced",
      features,
    });
    homePoints += log.homeScore;
    awayPoints += log.awayScore;
    if (log.homeScore > log.awayScore) homeWins += 1;
    else if (log.awayScore > log.homeScore) awayWins += 1;
    else ties += 1;
    if (log.homeScore === 0 || log.awayScore === 0) shutouts += 1;
    for (const drive of log.drives) {
      for (const play of drive.plays) {
        if (
          play.playType === "rush" ||
          play.playType === "pass_complete" ||
          play.playType === "pass_incomplete" ||
          play.playType === "sack" ||
          play.playType === "interception"
        ) {
          scrimmagePlays += 1;
        }
      }
    }
  }

  const pct = (n: number) => `${((n / GAMES) * 100).toFixed(1)}%`;
  const per = (n: number) => (n / GAMES).toFixed(1);
  console.log(`\n${label}`);
  console.log(
    `  home ${pct(homeWins)}  away ${pct(awayWins)}  ties ${pct(ties)}  shutout ${pct(shutouts)}`,
  );
  console.log(
    `  mean home ${per(homePoints)}  mean away ${per(awayPoints)}  TOTAL ${per(homePoints + awayPoints)}`,
  );
  console.log(`  scrimmage plays/game ${per(scrimmagePlays)}`);
}

const a = roster("home", 70);
const b = roster("away", 70);
const identical = a.every(
  (p, i) => p.overall === b[i].overall && p.position === b[i].position,
);
console.log(`EVEN 70v70 over ${GAMES} seeds`);
console.log(`rosters identical (overall + position): ${identical}`);
console.log(`targets: home win 52-60%, |mean home - mean away| <= 3, total 30-60`);

report("v1 — FROZEN, no gates (pinned by golden parity)", undefined);
report("+ situational (A3 clock and decisions)", { situational: true });
report("+ situational + balance (#642 fix)", {
  situational: true,
  balance: true,
});
report("all A gates", {
  situational: true,
  balance: true,
  scoringV2: true,
  penalties: true,
});

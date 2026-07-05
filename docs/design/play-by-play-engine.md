# Play-by-Play Simulation Engine

Status: approved design (2026-07-05). Decision record: stats derive from plays — no
score-derived stat synthesizer. Class-year dynasty and Gamecast UI build on this later.

## Context

Today `simulateScore()` (apps/web/src/lib/simulate-game.ts) draws a single final score from
team strength (mean SPRT `weightedOverall`, Madden fallback, else 50) with a seeded
mulberry32 PRNG. `recordGameResult` stores only final scores; `playerStatsJson` stays null on
the sim path. Stat infrastructure exists and is consumed downstream
(`playerGameStats.statsJson` → `computeSeasonSprt`, `getSeasonStatLeaders`) but nothing
produces stats when simming.

This design replaces the single-draw score with a **deterministic play-by-play engine** whose
plays are the canonical source of scores AND player stat lines.

## Slices

- **A — engine lib (this slice):** pure TS in `apps/web/src/lib/pbp/`. No Convex, no UI.
- **B — persistence + wiring:** store the game log per fixture (JSON blob ≤1MB, following the
  established `playerStatsJson` pattern), wire the sim server actions to run the engine and
  upsert derived stat lines via the existing internal `upsertPlayerGameStats`.
- **C — Gamecast UI (Task 9):** drive-chart view + play/quarter/half/game stepping over the
  stored log.

## Slice A contract

### Module layout (`apps/web/src/lib/pbp/`)

- `types.ts` — `PbpPlay`, `PbpDrive`, `PbpGameLog`, `TeamSimProfile`, `PlayerSimProfile`
- `engine.ts` — `simulateGameLog(input: PbpGameInput): PbpGameLog`
- `derive-stats.ts` — `deriveStatLines(log: PbpGameLog): Array<{ playerId, teamId, statLine }>`
- `index.ts` — public re-exports

### Inputs (plain objects; callers fetch data — the engine never does I/O)

```ts
type PlayerSimProfile = {
  playerId: string;
  position: string;        // raw position code (QB, RB/HB/FB, WR, TE, OL, DL/DT/DE, LB/ILB/OLB, CB/S/FS/SS, K, P)
  overall: number;         // resolved rating 0-99 (weightedOverall or Madden fallback)
  positionSlot?: string;   // from depthChartEntries/rosterAssignments when available
  depthRank?: number;
};
type TeamSimProfile = { teamId: string; strength: number; players: PlayerSimProfile[] };
type PbpGameInput = {
  home: TeamSimProfile; away: TeamSimProfile;
  seed: number;            // same seed => byte-identical log
  decisive?: boolean;      // playoff: overtime until no tie
};
```

Determinism reuses the existing primitives — import/re-export `seedFromString` and the
mulberry32 generator from `simulate-game.ts` rather than duplicating them.

### Game model

Quarter-based state machine: possession, down/distance, field position (0–100 offense
perspective), game clock (seconds, monotonic per quarter), score. Drives group plays;
play types: kickoff, rush, pass (complete/incomplete/sack/interception), punt, field goal,
extra point, kneel. Outcomes sample rating-weighted distributions; team `strength`
differential biases per-play success similarly in spirit to the current score model
(baseline ~21 ppg, home edge, ±swing) so league scoring stays in a familiar range.
`decisive` adds sudden-death OT periods until untied.

Participant selection: prefer depth order (`positionSlot` + `depthRank`), else highest
`overall` in the position group; skill plays distribute across the top backs/receivers with
rating-weighted shares. Defensive credit (tackles, sacks, INTs, pass deflections, FF/FR)
distributes across DL/LB/DB with position-appropriate weights.

### Stat derivation (Slice B consumes this)

`deriveStatLines` reduces the log into the **exact** `PlayerGameStatLine` shape from
`@sports-management/shared-types` (validated against `PlayerGameStatLineSchema` from
`@sports-management/api-contracts` in tests):

`passing(comp, att, yards, td, int, sacked)` · `rushing(carries, yards, td, long)` ·
`receiving(rec, yards, td, long, targets)` · `defense(tacklesSolo, tacklesAst, tfl, sacks,
int, passDef, ff, fr, defTd)` · `kicking(fgMade, fgAtt, xpMade, xpAtt)` ·
`punting(punts, yards, long)` · `returns(krCount, krYards, krTd, prCount, prYards, prTd)` ·
`ballSecurity(fumbles, fumblesLost)`

### Invariants (unit-tested)

1. Same seed → identical `PbpGameLog` (deep equality) and identical derived stat lines.
2. Score consistency: final score equals the sum of scoring plays (6·TD + XP + 3·FG + 2·safety
   if modeled).
3. Stat/score consistency: team passing+rushing TDs in stat lines match TD plays; kicking
   fgMade/xpMade match FG/XP plays.
4. Team stat totals equal the sum of player stat lines; every stat line validates against
   `PlayerGameStatLineSchema`.
5. `decisive: true` never returns a tie; without it ties are possible.
6. Clock/quarter monotonicity; drives alternate possession except after turnovers/scores.
7. Serialized `PbpGameLog` stays well under the Convex 1MB blob limit (assert < 300KB).
8. Distribution sanity across 100+ seeded games: mean total points within a plausible HS range
   (~30–60), stronger team wins majority of large-differential matchups.

### Non-goals for Slice A

No Convex reads/writes, no schema changes, no changes to `simulateScore` or the schedule
actions (Slice B swaps the call site), no UI. `simulate-game.ts` may only gain exports needed
for PRNG reuse.

## Slice B contract (summary — final after A ships)

- New `gamePlayLogs` storage (or `playsJson` on `gameResults`) written via **internalMutation**
  in the `recordGameResult` transaction path; follow the `playerStatsJson` JSON-string pattern.
- Schedule sim actions build `TeamSimProfile`s from `getTeamAttributeSnapshots` /
  `getTeamMaddenOveralls` + depth queries, call `simulateGameLog`, persist the log, record the
  final score through the existing `recordGameResult` (playoff advancement untouched), and
  upsert each derived line through internal `upsertPlayerGameStats` so `computeSeasonSprt` and
  stat leaders work unchanged.

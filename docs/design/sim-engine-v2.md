# Sim Engine v2 (Epic A)

Status: approved design (2026-07-25). Decision record: extend the versioned play log
with optional fields and bump `PBP_ENGINE_VERSION` per slice; never rewrite stored logs
or extend `PlayerGameStatLine` in `packages/api-contracts`. Covers Epic A / Waves 1–3
(slices A1–A6); gated by `FLAG_DYNASTY_SIM_V2` (`resolveFlag` idiom in
`apps/web/src/lib/flags.ts:11`) plus the per-league `dynastyConfig` kill switches
`penaltiesEnabled`, `injuriesEnabled` and `weatherEnabled` (Epic F, slice F5), which let a
live league back a mechanic out without a deploy.

Extended by nothing yet — extends `docs/design/play-by-play-engine.md` (v1 baseline).

## Context

**Shipped today**

- `simulateGameLog` (`apps/web/src/lib/pbp/engine.ts:788`), `runScrimmagePlay` (`:757`),
  `doRush` (`:472`), `doPass` (`:534`); `PBP_ENGINE_VERSION = "1.0.0"`
  (`apps/web/src/lib/pbp/index.ts:16`).
- Logs persist on `gamePlayLogs` with `engineVersion` (`apps/web/convex/schema.ts:329`).
- Stats derive via `derive-stats.ts` into `PlayerGameStatLine`; sim path uses
  `upsertPlayerGameStats` (`sports.ts:6240`).
- 4th-down decision is three distance bands + random pass/rush inside `runScrimmagePlay`.
- No penalties, injuries, fatigue, weather, timeouts, two-point, onside, or safety play
  types in `engine.ts` / `types.ts`.

**Missing**

- Optional `PbpPlay` / `PbpGameLog` fields and new play types; `pbp/migrate-log.ts`
  `normalizeGameLog()` for in-memory up-convert.
- `playerInjuries` and `rivalries` tables; Convex surface in `convex/sim.ts`.
- Gamecast penalty/injury/weather UI; injury report on Team Home; schedule weather icon.
- Scheme parameters (A6) — ships immediately after program schemes (C3).

**Explicit contract rule:** penalties, snap counts, and penalty totals stay in the
versioned play log only. Do **not** extend `PlayerGameStatLine` in
`packages/api-contracts` — box score, MaxPreps export, SPRT, and stat leaders must not
gain penalty columns (WSM-000166 drift class).

## Schema changes

```ts
playerInjuries: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  teamId: v.id("teams"),
  playerId: v.id("players"),
  fixtureId: v.optional(v.id("fixtures")),
  injuryType: v.string(),          // "hamstring" | "ankle" | "concussion" | "acl" | …
  severity: v.string(),            // "minor" | "moderate" | "severe" | "season_ending"
  gamesOut: v.number(),
  weekOccurred: v.optional(v.number()),
  returnsAfterWeek: v.optional(v.number()),
  status: v.string(),              // "out" | "questionable" | "recovered"
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("by_season_player", ["seasonId", "playerId"])
  .index("by_season_team", ["seasonId", "teamId"])
  .index("by_season_status", ["seasonId", "status"]),

rivalries: defineTable({
  leagueId: v.id("leagues"),
  teamAId: v.id("teams"),
  teamBId: v.id("teams"),
  intensity: v.number(),
  label: v.optional(v.string()),
})
  .index("by_league", ["leagueId"])
  .index("by_pair", ["leagueId", "teamAId", "teamBId"]),
```

`PbpPlay` / `PbpGameLog` TypeScript-only extensions (optional): `penalty`, `injury`,
`returnYards`, `isReturnTd`, `isTwoMinuteDrill`, `timeoutsRemaining`, `weather`,
`penaltyTotals`, `rivalry`; play types include `two_point_convert`, `safety`,
`onside_kick`, `penalty`, `spike`, `timeout`. Bump `PBP_ENGINE_VERSION` each slice.

## Function surface

**Module:** `apps/web/convex/sim.ts`.

| Symbol | Kind | Purpose |
|--------|------|---------|
| `listPlayerInjuries` | query | Team / season injury report |
| `upsertInjuryFromSim` | internalMutation | Post-game injury rows |
| `healInjuriesForSeason` | internalMutation | Offseason hook (B2) |
| `listRivalries` | query | League rivalry config |
| `upsertRivalry` | internalMutation | Commissioner setup |

Sim execution stays in Next server actions (existing schedule sim path); `sim.ts` only
persists injury/rivalry docs. `recordGameResult` transaction may call injury upserts.

## Pure-lib work

All under `apps/web/src/lib/pbp/` — zero Convex in unit tests.

| Module | Exports |
|--------|---------|
| `penalties.ts` | `rollPenalty(ctx)`, `resolveAcceptDecline(ctx)` |
| `situational.ts` | `chooseFourthDown(ctx)`, onside/clock/spike/timeout helpers |
| `fatigue.ts` | `applyFatigue(state, play)` |
| `injuries.ts` | `rollInjury(ctx)` |
| `weather.ts` | `weatherForFixture(season, week, venueId)` |
| `schemes.ts` | `applySchemeTendencies(profile, schemeDoc)` — **identity default** |
| `crowd.ts` | `crowdModifier(home, rivalry)` |
| `migrate-log.ts` | `normalizeGameLog(log): PbpGameLog` |

RNG uses `apps/web/src/lib/rng.ts` namespaces from Epic F.

## UI surface

- Gamecast: penalty chips, injury callouts, weather strip (existing fixture route).
- Box score: penalty totals from log JSON (not DTO contract).
- Team Home: injury report card.
- Season schedule: weather icon per fixture.
- No new top-level routes; use existing season/fixture URLs per ADR 0001 and
  `seasonSubpageHref` (`resource-navigation.ts:105`).

## Slices

- **A1 — scaffolding + scoring completeness:** safeties, two-point, fumble/return TD
  paths, version bump, golden-log parity harness. **Depends:** F1.
- **A2 — penalties.** **Depends:** A1.
- **A3 — situational AI + clock** (highest feel-per-LOC). **Depends:** A1.
- **A4 — fatigue / durability / injuries** + `playerInjuries`. **Depends:** F4, A1.
- **A5 — weather / crowd / rivalry.** **Depends:** A1 (prestige input optional until C2).
- **A6 — schemes** (consumes `src/lib/program/schemes.ts` after C3). **Depends:** C3, A1.

Each slice adding tables extends `resetCanonicalFixture` (`e2eSeed.ts:530`) in the same PR.

## Invariants

1. With v2 features disabled, `simulateGameLog` reproduces the pinned v1 log byte-for-byte
   for a fixed seed (re-run every A slice).
2. A `negatesPlay` penalty grants zero stat credit in `deriveStatLines`.
3. Injured-out players never appear as participants in a later fixture in the same season.
4. Timeouts remaining never negative.
5. Balance band over 200 seeded games per flavor: mean total points 30–60; 4–9 penalties
   per team; 0–2 injuries per game; favorite wins ≥65% at ≥15 strength differential.
6. Serialized v2 log < 400KB per game.
7. Stored `gamePlayLogs` rows are never updated in place for migration — readers call
   `normalizeGameLog`.
8. `PlayerGameStatLineSchema` unchanged in api-contracts; penalty data only in log JSON.

## Non-goals

- Rewriting historical `logJson` blobs on deploy.
- Extending `packages/api-contracts` stat lines for penalties or snap counts.
- Coach skill tree or program prestige (Epic C) except scheme hook at A6.
- Public Convex mutations; all writes `internalMutation` (WSM-000096).
- Moving sim orchestration out of existing server actions into client-side Convex.

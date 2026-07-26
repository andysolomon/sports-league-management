# Dynasty Foundations (Epic F)

Status: approved design (2026-07-25). Decision record: persist season and player
aggregates plus an append-only dynasty event log so later epics never scan fixtures
or loop `ctx.db.get` on stat leaders. Covers Epic F / Wave 0 (slices F1–F5); no
dedicated feature flag — consumers gate on `FLAG_DYNASTY_*` and `dynastyConfig`.

## Context

**Shipped today**

- Standings recompute from every fixture on read via `computeStandingsPure`
  (`apps/web/convex/lib/standings.ts:105`) — correct but full-scan.
- Per-game stats live in `playerGameStats`; season SPRT and leaders call
  `computeSeasonSprt` (`apps/web/convex/sports.ts:6497`) and `seasonStatLeaders`
  (`sports.ts:6576`) with per-row `ctx.db.get` — known N+1.
- `recordGameResult` (`sports.ts:5522`) and `upsertPlayerGameStats` (`sports.ts:6240`)
  are the only write hooks that touch game outcomes; no persisted W/L counters or
  career rows exist.
- Convex writes are already `internalMutation` only (WSM-000096); the compile-time
  guard lives in `apps/web/convex/__tests__/writeMutationsAreInternal.test.ts`.
- Pages call Convex only through `apps/web/src/lib/data-api.ts` →
  `getConvexClient()` — no `convex/react`.
- DTO mappers pin `Infer<typeof xDtoValidator>` (`sports.ts:143` — `playerDtoValidator`).

**Missing**

- `seasonTeamRecords`, `playerSeasonAggregates`, `dynastyEvents`, `dynastyConfig` tables.
- Module split: all sports surface still in `sports.ts` (~7500+ LOC); new dynasty
  surface must land in `convex/dynasty.ts` without moving existing exports.
- Shared deterministic RNG namespace (`seedFromString` / mulberry32 still live only in
  `simulate-game.ts`).
- Typed function-reference helpers for new modules (`data-api.ts:63` — string names
  compile on typos).

## Schema changes

Compose from `apps/web/convex/tables/dynasty.ts` (new) and spread into `schema.ts`.
All new fields on existing tables remain `v.optional` elsewhere; these tables are new.

```ts
// AS SHIPPED in F2 (#614). Divisional splits and head-to-head are required,
// not optional: the tiebreak chain reads them on every standings render, so an
// absent value would be a silent wrong answer rather than a missing nicety.
// `streak` is a signed number (+n win streak, -n loss streak) rather than JSON,
// and `lastResults` / `gamesCounted` were added for recent form and to make
// playoff exclusion assertable.
seasonTeamRecords: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  teamId: v.id("teams"),
  divisionId: v.union(v.id("divisions"), v.null()),
  wins: v.number(),
  losses: v.number(),
  ties: v.number(),
  pointsFor: v.number(),
  pointsAgainst: v.number(),
  divisionWins: v.number(),
  divisionLosses: v.number(),
  divisionTies: v.number(),
  headToHeadJson: v.string(),
  streak: v.number(),
  lastResults: v.array(v.string()),
  gamesCounted: v.number(),
  updatedAt: v.string(),
})
  .index("by_seasonId", ["seasonId"])
  .index("by_seasonId_teamId", ["seasonId", "teamId"])
  .index("by_teamId", ["teamId"])
  .index("by_leagueId_seasonId", ["leagueId", "seasonId"]),

// AS SHIPPED in F3 (#615). `gamesPlayed` is required — SPRT rates per-game,
// so deriving it would mean re-reading the rows this table exists to avoid.
// `position` is stored alongside `positionGroup`, but the SPRT read path
// deliberately does NOT trust either for grouping: it joins live `players`
// rows, so an offseason position change (B5) cannot silently mis-rate a player
// before a rebuild runs.
playerSeasonAggregates: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  teamId: v.id("teams"),
  playerId: v.id("players"),
  position: v.string(),
  positionGroup: v.union(v.string(), v.null()),
  gamesPlayed: v.number(),
  totalsJson: v.string(),
  updatedAt: v.string(),
})
  .index("by_seasonId", ["seasonId"])
  .index("by_playerId_seasonId", ["playerId", "seasonId"])
  .index("by_playerId", ["playerId"])
  .index("by_leagueId_seasonId", ["leagueId", "seasonId"]),

dynastyEvents: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.optional(v.id("seasons")),
  category: v.string(),
  eventType: v.string(),
  severity: v.string(),
  headline: v.string(),
  bodyJson: v.optional(v.string()),
  dedupeKey: v.string(),
  createdAt: v.string(),
})
  .index("by_league_created", ["leagueId", "createdAt"])
  .index("by_dedupeKey", ["dedupeKey"]),

dynastyConfig: defineTable({
  leagueId: v.id("leagues"),
  simV2Enabled: v.optional(v.boolean()),
  offseasonV2Enabled: v.optional(v.boolean()),
  programV1Enabled: v.optional(v.boolean()),
  historyV1Enabled: v.optional(v.boolean()),
  updatedAt: v.string(),
}).index("by_leagueId", ["leagueId"]),
```

No backfill migration: absence of `dynastyConfig` means all defaults; F2/F3 deltas
apply on the next `recordGameResult` / stat upsert after deploy.

## Function surface

**Module:** `apps/web/convex/dynasty.ts` (queries + `internalMutation` only).

| Symbol | Kind | Purpose |
|--------|------|---------|
| `getDynastyConfig` | query | League kill switches / defaults |
| `upsertDynastyConfig` | internalMutation | Settings card writes |
| `getSeasonTeamRecord` | query | Single team-season row |
| `listSeasonTeamRecords` | query | Season standings inputs |
| `applyGameResultToRecords` | internalMutation | Called from `recordGameResult` txn |
| `rebuildSeasonTeamRecords` | internalMutation | Admin repair / golden tests |
| `applyPlayerGameStatsDelta` | internalMutation | Called from `upsertPlayerGameStats` |
| `rebuildPlayerSeasonAggregates` | internalMutation | Admin repair |
| `emitDynastyEvent` | internalMutation | Append event; dedupe by key |
| `listDynastyEvents` | query | Paginated feed (D4 consumer) |

Existing `sports.ts` handlers gain **calls into** these internal mutations; they are
not moved or renamed (`internal.sports.*` guard strings stay stable).

**`data-api.ts`:** add `dynastyQueryRef` / `dynastyInternalRef` template-literal helpers
typed from `import type { api } from "../convex/_generated/api"` (F1 verifies no client
bundle pull).

## Pure-lib work

| Module | Exports |
|--------|---------|
| `apps/web/convex/lib/teamRecords.ts` | `applyResultDelta(row, delta): SeasonTeamRecordCounters` |
| `apps/web/convex/lib/events.ts` | `buildDedupeKey(parts): string`, `shouldSkipEmit(existingKey): boolean` |
| `apps/web/convex/lib/narrative.ts` | `renderHeadline(template, ctx): string` |
| `apps/web/src/lib/rng.ts` | `seedFromString(s): number`, `mulberry32(seed): () => number`, namespace helpers (`pbp:fixtureId`, etc.) |

Ranking display still runs `computeStandingsPure` on **read models** built from
`seasonTeamRecords` so tiebreaker tests remain authoritative.

## UI surface

- `/dashboard/settings/league` — Dynasty settings card (read/write `dynastyConfig` via
  server action → internal mutation). No new routes.
- ADR 0001 unchanged: no competition views added here.

## Slices

- **F1 — scaffolding:** `convex/tables/dynasty.ts`, empty `dynasty.ts` module, typed
  refs in `data-api.ts`, `rng.ts` promotion, guard-test backstop for `dynasty` writes.
  **Depends:** none. **Same PR:** extend `resetCanonicalFixture`
  (`apps/web/convex/e2eSeed.ts:530`) for any table touched (initially none beyond seed
  tolerance).
- **F2 — season team records:** hook `recordGameResult`; delta subtract prior contribution
  on re-sim. **Depends:** F1.
- **F3 — player season aggregates:** hook `upsertPlayerGameStats`; refactor
  `computeSeasonSprt` / `seasonStatLeaders` to read aggregates only. **Depends:** F1.
- **F4 — event log:** `emitDynastyEvent` + dedupe. **Depends:** F1.
- **F5 — dynasty config:** settings UI + per-league toggles. **Depends:** F1.

Every slice that adds rows must add cleanup to `resetCanonicalFixture` in the same PR.

## Invariants

1. `computeStandingsPure` output deep-equals pre-F2 standings for the canonical e2e
   fixture (golden test).
2. **As implemented in F2**, the cache is kept correct by REBUILDING the two teams a
   result touches from their own games (`fixtures` is indexed
   `by_homeTeamId`/`by_awayTeamId`, so that is ~10–16 rows, not a scan), rather than
   by applying arithmetic deltas in place. Wins, points and head-to-head are
   commutative and would survive a true delta, but `streak` and `lastResults` are
   order-dependent: re-recording an EARLIER game (a re-sim under a new engine
   version) cannot be corrected by adding and subtracting counters. Rebuild-from-source
   is equal to a full rebuild by construction. A team with zero counted games is
   stored as NO row, so a rebuild yields exactly the row set incremental maintenance
   would, and standings default a missing row to 0-0-0.
3. Record → re-record → delete game leaves `seasonTeamRecords` identical to a full
   rebuild (property test).
3. `computeSeasonSprt` and `seasonStatLeaders` perform zero `ctx.db.get` inside player
   loops (read-spy on ctx).
4. Duplicate `dedupeKey` inserts at most one `dynastyEvents` row.
5. All `dynasty.ts` write handlers are `internalMutation` and appear only on
   `internal.dynasty.*` in the guard test.
6. Every new handler declares `returns:`; every DTO mapper uses `Infer<typeof …Validator>`.
7. `applyResultDelta` is pure; Convex handlers only persist its output.

## Non-goals

- Moving or renaming existing `sports.ts` exports.
- Public Convex mutations or `convex/react` subscriptions.
- Career totals, awards, polls (Epic D).
- Penalties, injuries, or play-log schema (Epic A).
- Offseason phase machine (Epic B).
- Wave 5 multi-coach UX (only data hooks that later epics require).

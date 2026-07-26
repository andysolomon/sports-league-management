# Offseason & Roster Pipeline (Epic B)

Status: approved design (2026-07-25). Decision record: keep `seasonRollovers` for the
60-second mechanical prologue; add persisted `offseasons` for human-paced phases;
authorize per-team actions via `teamId` + `authorizeTeamMutation`, never org-admin-only.
Covers Epic B / Waves 1–2 (slices B1–B6); gated by `FLAG_DYNASTY_OFFSEASON_V2`.

Extends `docs/design/dynasty-mode.md` and `docs/design/offseason-free-agency-draft.md`
(reuses draft/FA mutations; does not replace them).

## Context

**Shipped today**

- Six-stage rollover with lease (`ROLLOVER_STAGES` at `dynasty.ts:40`;
  `startNextSeasonAction` at `:149`).
- Offseason hub UI derives phases from draft status — `buildPhases(draftStatus)` at
  `OffseasonPhaseStepper.tsx:12` (not stored, not resumable).
- Draft: `startDraft` / `makeDraftPick` / `endDraft` (`sports.ts:5300,5358,5451`);
  `DRAFT_ROUNDS = 3` (`:5202`).
- FA: `releasePlayerToFreeAgency` (`:5050`), `signFreeAgent` (`:5086`).
- Roster caps: `targetRosterSize` — default 48, max 60 (`convex/lib/offseason.ts:8-13`).
- Freshmen generated in rollover without scouting (`dynasty.ts:418` —
  `generateSyntheticRoster`).

**Missing**

- `offseasons`, `recruitProspects`, `transferEvents`, `playerTrainingAllocations`.
- Rollover stages `injuries_healed`, `prospects_generated` before `completed`.
- Scouting uncertainty, transfers, JV→Varsity promotions, position changes, training
  loops on `players.squad`.
- Route `/dashboard/seasons/[id]/offseason` and `"offseason"` in `seasonSubpageHref`
  union (`resource-navigation.ts:107`).

**Authorization precedent:** `canAdminOrManageTeam` in
`apps/web/src/app/dashboard/_actions/offseason.ts:18` — Wave 5 requires the same
pattern using `authorizeTeamMutation` / `resolveTeamRole`
(`apps/web/src/lib/authorization.ts:53`).

## Schema changes

```ts
offseasons: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  phase: v.string(),
  completedPhases: v.array(v.string()),
  scoutingPoints: v.optional(v.number()),
  trainingPoints: v.optional(v.number()),
  phaseLeaseOwnerId: v.optional(v.string()),
  phaseLeaseExpiresAt: v.optional(v.string()),
  configSnapshotJson: v.optional(v.string()),
  updatedAt: v.string(),
})
  .index("by_seasonId", ["seasonId"])
  .index("by_leagueId", ["leagueId"]),

recruitProspects: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  teamId: v.optional(v.id("teams")),
  trueAttributesJson: v.string(),
  scoutedAttributesJson: v.optional(v.string()),
  scoutLevel: v.number(),
  projectedRangeJson: v.optional(v.string()),
  archetype: v.optional(v.string()),
  potentialTier: v.optional(v.string()),
  status: v.string(),
})
  .index("by_season_team", ["seasonId", "teamId"])
  .index("by_season", ["seasonId"]),

transferEvents: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  playerId: v.id("players"),
  fromTeamId: v.optional(v.id("teams")),
  toTeamId: v.optional(v.id("teams")),
  eventType: v.string(),
  createdAt: v.string(),
})
  .index("by_season", ["seasonId"]),

playerTrainingAllocations: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  teamId: v.id("teams"),
  playerId: v.id("players"),
  allocationJson: v.string(),
  updatedAt: v.string(),
})
  .index("by_season_team", ["seasonId", "teamId"])
  .index("by_season_player", ["seasonId", "playerId"]),
```

Extend `seasonRollovers.stage` vocabulary with `injuries_healed` and
`prospects_generated` (string stage values; no table migration beyond code).

## Function surface

**Module:** `apps/web/convex/dynasty.ts` (offseason subset; same module as Epic F).

| Symbol | Kind | Purpose |
|--------|------|---------|
| `getOffseason` | query | Phase + budgets for hub |
| `advanceOffseasonPhase` | internalMutation | Commissioner advance (lease) |
| `allocateScoutingPoints` | internalMutation | Per-team; `teamId` in args |
| `scoutProspect` | internalMutation | Per-team |
| `listProspects` | query | **Never returns `trueAttributesJson`** |
| `proposeTransfer` / `resolveTransfer` | internalMutation | Transfer pipeline |
| `setPromotion` / `setPositionChange` | internalMutation | Per-team |
| `allocateTraining` | internalMutation | Per-team |
| `applyTrainingToProgression` | internalMutation | Calls progression with optional inputs |

Reused unchanged: `signFreeAgent`, `releasePlayerToFreeAgency`, `startDraft`,
`makeDraftPick`, `endDraft` in `sports.ts`.

Server actions in `apps/web/src/app/dashboard/_actions/offseason.ts` (and new files)
call `authorizeTeamMutation(teamId, userId)` before internal calls.

## Pure-lib work

Under `apps/web/src/lib/dynasty/`:

| Module | Exports |
|--------|---------|
| `offseason-phases.ts` | `nextPhase(current)`, `canAdvance(offseason)` — mirrors `hasReachedRolloverStage` |
| `prospects.ts` | `generateProspectClass(input)` |
| `scouting.ts` | `scoutedBand(trueAttrs, level)` — monotonic shrink, never zero width |
| `transfers.ts` | `validateTransfer(ctx)` |
| `promotions.ts` | `applySquadChange(player, targetSquad)` |
| `training.ts` | `sumAllocations(allocations)` |

Optional `ProgressionInput` extensions in `dynasty-progression.ts`: `training?`,
`developmentMultiplier?` — base delta unchanged when `training: []`.

## UI surface

- `/dashboard/seasons/[id]/offseason` — Offseason Hub (flag-gated).
- Extend `seasonSubpageHref` and `buildSeasonSiblingLinks` (`resource-navigation.ts:184`)
  with `"offseason"`.
- Rewire `OffseasonPhaseStepper` to persisted `offseasons.phase`, not `buildPhases`.
- Panels: Scouting, Transfers, Promotions, Training, Summary (DS components).
- Add **Offseason Hub** to `CONTEXT.md` before UI merge.
- ADR 0001: offseason is season-scoped under Season Home.

## Slices

- **B1 — persisted phase machine** (structural; no new gameplay). **Depends:** F1.
- **B2 — injury healing stage** on rollover + `sim.healInjuriesForSeason`. **Depends:** A4, B1.
- **B3 — recruiting class + scouting.** **Depends:** B1.
- **B4 — transfers.** **Depends:** B1.
- **B5 — promotions / position changes / cuts** (cuts → `releasePlayerToFreeAgency`).
  **Depends:** B1.
- **B6 — training → progression.** **Depends:** B1, B5.

Table-adding slices must update `resetCanonicalFixture` (`e2eSeed.ts:530`) in the same PR.

## Invariants

1. `trueAttributesJson` never appears in any page-reachable query `returns:` validator
   (assert on `listProspects`).
2. Scouting bands nest monotonically and are deterministic per `(prospectId, scoutLevel)`.
3. Offseason phases only move forward.
4. Concurrent `advanceOffseasonPhase` → one winner, other gets `phase_busy`.
5. Signing a prospect is idempotent on re-invoke.
6. `computeProgressedAttributes` with `training: []` byte-matches pre-B6 output.
7. Per-team mutations reject when `authorizeTeamMutation` fails for the supplied `teamId`.
8. All writes `internalMutation`; handlers include `returns:` validators.

## Non-goals

- College recruiting hours, star ratings, or national signing day metaphors.
- Contracts or salary cap.
- Replacing snake draft or FA tables from offseason-free-agency-draft.
- Wave 5 coach assignment UI (data model only via `teamId` auth).
- Moving draft/FA functions out of `sports.ts`.

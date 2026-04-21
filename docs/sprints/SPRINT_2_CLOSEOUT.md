# Sprint 2 — Phase 1 Close-Out

> **Sprint:** 2026-04-22 (single-day burst)
> **Companion docs:** [SPRINT_2_VERIFICATION.md](./SPRINT_2_VERIFICATION.md) — criteria matrix + flag-flip checklist
> **Stories shipped:** WSM-000010..WSM-000020 (11 PRs)
> **Feature flag:** `roster_snapshots_v1` (production default: off)

Phase 1 delivers per-team season rosters with active + IR + suspended + released status slots, roster-limit enforcement, a transactional audit log, a migration from Phase 0 `depthChartEntries`, the roster + audit UI, and Phase 1 E2E smoke. All eleven stories landed as separate PRs — Sprint 0's semantic-release automation cut a minor version per `feat:` merge.

Per-story implementation notes below. Paired with the verification matrix; this document captures the "what actually landed and why" for each issue.

---

## WSM-000010 — Schema: `rosterAssignments` + `rosterAuditLog`

**PR:** #115

### Files touched
- `apps/web/convex/schema.ts` — new `rosterAssignments` + `rosterAuditLog` tables
- `packages/shared-types/src/index.ts` — `RosterAssignmentDto`, `RosterAuditLogDto`, `RosterAuditAction`

### Key decisions
- `depthRank: v.number()` (not nullable). Non-active rows carry `depthRank: 0` as a sentinel meaning "not on the active chart." Keeps the composite index totally ordered.
- Audit log stores `beforeJson` / `afterJson` as stringified DTO snapshots — no denormalized `playerId` column. Substring filtering in WSM-000015 is the tradeoff; revisit if audit volume grows.
- `leagueId` denormalized onto `rosterAssignments` so authorization checks don't need a second `teams` lookup.

---

## WSM-000011 — Flag: `roster_snapshots_v1`

**PR:** #116

### Files touched
- `apps/web/src/lib/flags.ts` — `rosterSnapshotsV1` declared alongside `depthChartV1`
- `apps/web/src/lib/__tests__/flags.test.ts` — added on/off cases for the new guard

### Key decisions
- Kept Phase 1 behind a separate flag from Phase 0 so `depth_chart_v1` can stay live in production while `roster_snapshots_v1` is still under flag.
- Same `pageGuard` / `apiGuard` pattern as Phase 0. No new helper shape.

---

## WSM-000012 — `players.positionGroup` + backfill

**PR:** #117

### Files touched
- `apps/web/convex/schema.ts` — add `players.positionGroup: v.optional(v.string())`
- `apps/web/convex/lib/positionGroup.ts` — canonical slot → group lookup (e.g. `LT` → `OL`)
- `apps/web/convex/migrations/20260428_playersPositionGroup.ts` — one-shot backfill
- `apps/web/convex/sports.ts` — project `positionGroup` onto `PlayerDto`
- `packages/shared-types/src/index.ts` — extend `PlayerDto`

### Key decisions
- Optional column — nullable for unknown positions rather than forcing a catch-all group.
- Backfill is idempotent — skips rows that already carry `positionGroup`.

---

## WSM-000013 — `writeAuditLog` helper

**PR:** #118

### Files touched
- `apps/web/convex/lib/auditLog.ts` — `writeAuditLog(ctx, {...})` helper
- `apps/web/convex/__tests__/auditLog.test.ts` — unit suite

### Key decisions
- Helper serializes `before` / `after` inline with `JSON.stringify`. Accepts `null` for either side so assign (`before=null`) and remove (`after=null`) are the same call shape.
- No separate batch API — every mutation that writes to `rosterAssignments` calls `writeAuditLog` exactly once in the same transaction.

---

## WSM-000014 — Roster mutations + transactional audit log

**PR:** #119

### Files touched
- `apps/web/convex/sports.ts` — `assignPlayerToRoster`, `removePlayerFromRoster`, `updateRosterStatus`
- `apps/web/convex/__tests__/rosterAssignments.test.ts` — convex-test scenarios for limit, lock, status cycles, duplicate guards, audit log count

### Key decisions
- Mutations take `actorUserId: v.string()` as an explicit argument. Auth lives at the Next.js server-action layer — keeps mutations callable from scripts/migrations without a Clerk context.
- `updateRosterStatus` re-checks `team.rosterLimit` on `* → active` transitions so reactivating from IR can be rejected with `roster_limit_exceeded`.
- On `active → non-active`, `depthRank` is reset to 0 and the slot's remaining active rows are compacted.
- `removePlayerFromRoster` rejects non-active rows (`cannot_remove_non_active`) so the "release" flow is explicit rather than silent.

---

## WSM-000015 — Roster query API

**PR:** #120

### Files touched
- `apps/web/convex/sports.ts` — `getRosterBySeasonTeam`, `getTeamRosterLimitStatus`, `getRosterAssignmentHistory`, `toRosterAuditLogDto`, `rosterAuditLogDtoValidator`
- `apps/web/convex/__tests__/rosterQueries.test.ts` — 12 scenarios (sort order, status transitions, cross-season isolation, limit passthrough, audit filtering)

### Key decisions
- Sort for `getRosterBySeasonTeam`: positionSlot (locale) → active-before-non-active → depthRank ascending → assignedAt. Makes the roster UI a simple `forEach` grouping.
- `getRosterAssignmentHistory.playerId` uses a JSON substring match (`"playerId":"${id}"`) against `beforeJson` / `afterJson`. Tradeoff accepted — see decision row in §11.1.
- `getTeamRosterLimitStatus.remaining` is `null` when `rosterLimit` is `null`, not `Infinity` — keeps the DTO validator simple.

---

## WSM-000016 — `depthChartEntries → rosterAssignments` migration

**PR:** #121

### Files touched
- `apps/web/convex/migrations/20260428_depthChartToRoster.ts` — `migrateDepthChartToRoster` mutation
- `apps/web/convex/__tests__/depthChartToRoster.test.ts` — three scenarios

### Key decisions
- Idempotent via index lookup: for every `depthChartEntries` row, check `rosterAssignments` on `(seasonId, teamId, positionSlot)` + `playerId` filter; skip if present.
- `depthRank = sortOrder + 1` (0-indexed → 1-indexed). All migrated rows land as `status: "active"`.
- Writes one `assign` audit row per copy. Skipped rows do not emit audit entries.
- Uses the typed `mutation` helper (not `mutationGeneric`) so inserts into `rosterAssignments` typecheck against the schema.
- Tests address the module via `anyApi.migrations["20260428_depthChartToRoster"].migrateDepthChartToRoster` because `_generated/api.d.ts` only typechecks `sports.ts`.

---

## WSM-000017 — Roster UI

**PR:** #122

### Files touched
- `apps/web/src/app/dashboard/teams/[id]/roster/page.tsx` — server component
- `apps/web/src/app/dashboard/teams/[id]/roster/actions.ts` — three server actions
- `apps/web/src/components/roster/RosterBoard.tsx` — client orchestrator
- `apps/web/src/components/roster/RosterSlotGroup.tsx` — active per-slot group with dropdown actions
- `apps/web/src/components/roster/RosterStatusList.tsx` — non-active tab content
- `apps/web/src/components/roster/AssignPlayerDialog.tsx` — shadcn Dialog + player select + slot input
- `apps/web/src/components/roster/RosterLimitBadge.tsx` — shadcn Badge
- `apps/web/src/lib/analytics.ts` — four new track functions
- `apps/web/src/lib/data-api.ts` — six roster refs + wrappers

### Key decisions
- No shadcn Tabs primitive yet — non-active statuses surface via a chip filter that cycles IR / suspended / released.
- `AssignPlayerDialog` pre-fills `positionSlot` from `player.position` but allows manual override (e.g., `QB` player listed in `QB2` slot).
- `atLimit` disables the **Add to Roster** button before the user even opens the dialog; the limit is enforced again in `assignPlayerToRoster` mutation for server-side integrity.
- Inlined a `<div>`-based dialog footer rather than adding a `DialogFooter` primitive — keeps the PR focused on roster UI.

---

## WSM-000018 — Audit log UI

**PR:** #123

### Files touched
- `apps/web/src/app/dashboard/teams/[id]/roster/audit/page.tsx` — server component
- `apps/web/src/components/roster/RosterAuditTimeline.tsx` — client timeline with filters
- `apps/web/src/components/roster/RosterBoard.tsx` — adds "Audit log" link in header

### Key decisions
- Parses `beforeJson` / `afterJson` with a `safeParse` helper so a single malformed row doesn't break the whole timeline.
- Delta rendering is action-specific: `assign` → `QB #1`; `remove` → `QB #1`; `status_change` → `active → ir`; `depth_reorder` → `QB` (position slot only, because reorder events don't carry a single player).
- Limits to 200 entries client-side (server-side `limit` is also 200). Pagination deferred — see follow-up in verification doc.

---

## WSM-000019 — Phase 1 E2E scaffolding

**PR:** #124

### Files touched
- `apps/web/e2e/tests/coach-roster.spec.ts`

### Key decisions
- Two live scenarios: `/roster` and `/roster/audit` both reachable when the flag is on (dev default).
- Seven `test.fixme` blocks cover assign / limit / IR cycle / reactivate-respecting-limit / audit trail / cross-team 403. Same convention as `coach-depth-chart.spec.ts` — wait for a Convex seed harness + second Clerk test user.

---

## WSM-000020 — Phase 1 ops + docs close-out

**PR:** this PR

### Files touched
- `docs/roster-management.md` — new §1 "Phase 1 — LIVE" table + 7 decision rows appended to §11.1
- `docs/sprints/SPRINT_2_VERIFICATION.md` — criteria matrix + flag-flip checklist
- `docs/sprints/SPRINT_2_CLOSEOUT.md` — this file

### Deferred to production-flip checklist
- Preview-deploy manual QA (six scenarios)
- Vercel Analytics verification of the four new events
- `pnpm convex run migrations:migrateDepthChartToRoster` against production data

---

## Running Vitest + type-check baseline at sprint close

- `pnpm --filter @sports-management/web type-check` — clean
- `pnpm --filter @sports-management/web lint` — one pre-existing warning, no new
- `pnpm --filter @sports-management/web test:unit` — **252 passed** (up from 191 at Sprint 1 close)

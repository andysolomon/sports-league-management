# Sprint 2 — Phase 1 Roster Management — Verification Report

> **Status:** Code merged to `main` behind `roster_snapshots_v1` flag. Awaiting production flag flip (preview-deploy manual QA + prod migration run).
> **Closed (code):** 2026-04-22
> **Source plan:** Linear project "Sprtsmng Roster Management" (WSM-000010..WSM-000020)
> **Design spec:** [`docs/roster-management.md`](../roster-management.md) §1 (Phase 1 — LIVE), §5.1, §5.2, §5.5, §11.1

Phase 1 delivers per-team season rosters (active + IR + suspended + released) with roster-limit enforcement, a transactional audit log, and a clean migration from Phase 0's `depthChartEntries` to `rosterAssignments`. Eleven stories shipped as eleven PRs.

## Criteria Matrix

| # | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| 1 | `rosterAssignments` + `rosterAuditLog` tables with indexes | `apps/web/convex/schema.ts` — `by_seasonId_teamId`, `by_seasonId_teamId_position`, `by_team_season` indexes | ✓ |
| 2 | `roster_snapshots_v1` flag declared; page + API guards share signature with Phase 0 | `apps/web/src/lib/flags.ts` — `rosterSnapshotsV1` alongside `depthChartV1` | ✓ |
| 3 | `players.positionGroup` backfilled from `position` | `apps/web/convex/migrations/20260428_playersPositionGroup.ts` + convex-test suite | ✓ |
| 4 | `writeAuditLog` helper serializes `before` / `after` into `rosterAuditLog` inside the same transaction | `apps/web/convex/lib/auditLog.ts` + unit suite | ✓ |
| 5 | `assignPlayerToRoster` respects `team.rosterLimit`, rejects locked seasons, blocks same-team duplicates | `apps/web/convex/__tests__/rosterAssignments.test.ts` | ✓ |
| 6 | `removePlayerFromRoster` compacts `depthRank` after delete | same suite — "compacts depthRank after a remove" | ✓ |
| 7 | `updateRosterStatus` re-applies the limit on `active → ir → active` cycles | same suite — "roster_limit_exceeded on reactivate" | ✓ |
| 8 | Each assign / remove / status_change writes exactly one `rosterAuditLog` row | same suite — audit-row count assertions | ✓ |
| 9 | `getRosterBySeasonTeam` sorts by positionSlot → active-first → depthRank | `apps/web/convex/__tests__/rosterQueries.test.ts` — "sorts by position, then active before non-active, then depthRank" | ✓ |
| 10 | `getTeamRosterLimitStatus` returns `{activeCount, rosterLimit, remaining}` with `null` rosterLimit passthrough | same suite | ✓ |
| 11 | `getRosterAssignmentHistory` supports optional `playerId` + `limit` | same suite — "filters by playerId", "honors limit" | ✓ |
| 12 | `depthChartEntries → rosterAssignments` migration is idempotent and 1-indexes `depthRank` | `apps/web/convex/__tests__/depthChartToRoster.test.ts` — "second run skips already-migrated rows", "sortOrder N → depthRank N+1" | ✓ |
| 13 | Migration writes one `assign` audit row per copied entry | same suite — "one audit row per migrated entry" | ✓ |
| 14 | `/dashboard/teams/[id]/roster` renders active roster with per-slot grouping + limit badge + assign dialog | `apps/web/src/app/dashboard/teams/[id]/roster/page.tsx`, `apps/web/src/components/roster/RosterBoard.tsx` | ✓ |
| 15 | Non-active rows surface in filter tab (IR / suspended / released) with reactivate + release actions | `apps/web/src/components/roster/RosterStatusList.tsx` | ✓ |
| 16 | `/dashboard/teams/[id]/roster/audit` renders the timeline with action + player filters | `apps/web/src/app/dashboard/teams/[id]/roster/audit/page.tsx`, `apps/web/src/components/roster/RosterAuditTimeline.tsx` | ✓ |
| 17 | Server actions enforce flag + Clerk org membership | `apps/web/src/app/dashboard/teams/[id]/roster/actions.ts` | ✓ |
| 18 | Four analytics events emitted: `roster_assign`, `roster_remove`, `roster_status_change`, `roster_limit_blocked` | `apps/web/src/lib/analytics.ts` | ✓ |
| 19 | E2E smoke verifies flag-gated `/roster` and `/roster/audit` routes reachable | `apps/web/e2e/tests/coach-roster.spec.ts` — two smoke tests pass | ✓ |
| 20 | Seed-dependent E2E scenarios parked as `test.fixme` with TODO notes | same spec — seven `test.fixme` blocks | ✓ |
| 21 | All pre-existing Vitest suites still pass (252/252) | `pnpm --filter @sports-management/web test:unit` | ✓ |
| 22 | Type-check + lint clean after every story | `pnpm --filter @sports-management/web type-check`, `pnpm --filter @sports-management/web lint` | ✓ |
| 23 | Production flag flip completed | Vercel Flags UI — `roster_snapshots_v1` = `on` in production for ≥48h, analytics monitored | ☐ pending preview QA + prod migration run |
| 24 | `depthChartEntries → rosterAssignments` migration invoked against production | `pnpm convex run migrations:migrateDepthChartToRoster` run + output captured | ☐ pending |

## PR / Release Evidence

| Story | Branch | PR | Expected bump |
| --- | --- | --- | --- |
| WSM-000010 | `feat/WSM-000010-roster-schema` | #115 | minor |
| WSM-000011 | `feat/WSM-000011-roster-snapshots-flag` | #116 | minor |
| WSM-000012 | `feat/WSM-000012-position-group-util` | #117 | minor |
| WSM-000013 | `feat/WSM-000013-audit-log-helper` | #118 | minor |
| WSM-000014 | `feat/WSM-000014-roster-mutations` | #119 | minor |
| WSM-000015 | `feat/WSM-000015-roster-queries` | #120 | minor |
| WSM-000016 | `feat/WSM-000016-depth-chart-migration` | #121 | minor |
| WSM-000017 | `feat/WSM-000017-roster-ui` | #122 | minor |
| WSM-000018 | `feat/WSM-000018-audit-log-ui` | #123 | minor |
| WSM-000019 | `feat/WSM-000019-phase-1-e2e` | #124 | no bump (`test:`) |
| WSM-000020 | `feat/WSM-000020-phase-1-closeout` | this PR | no bump (`docs:`) |

## Deferred / Follow-ups (not Phase 1 scope)

1. **Full E2E coverage** — seven roster scenarios (assign / limit-blocked / IR cycle / reactivate respecting limit / audit trail / cross-team 403) are parked behind a Convex seeding harness + second Clerk test user.
2. **Vercel Flags provider adapter** — both `depth_chart_v1` and `roster_snapshots_v1` still use static `decide()`. Adapter lands once `FLAGS` env var is provisioned in production.
3. **Salesforce mirror** — `RosterAssignment__c` / `RosterAuditLog__c` remain Phase 2 per `docs/roster-management.md` §4.3.
4. **Audit-log pagination** — current UI fetches last 200 entries. If a team exceeds that in a single season, add cursor-based pagination.
5. **Player-filtered history perf** — substring match against `beforeJson` / `afterJson` is acceptable at Phase 1 scale; revisit with a denormalized `playerId` column if audit volume grows past a few thousand rows per team.

## Flag-flip checklist

Do **not** flip `roster_snapshots_v1` to `on` in production until all of the following are checked:

- [ ] Preview-deploy manual QA: sign in as coach, open `/roster`, assign an eligible player → active count increments, row appears in the correct positionSlot
- [ ] Preview-deploy manual QA: move that player to IR → row disappears from active, appears under the **IR** tab with `depthRank=0`
- [ ] Preview-deploy manual QA: reactivate from IR while roster is at the limit → `roster_limit_exceeded` toast; release a different active player; reactivate succeeds
- [ ] Preview-deploy manual QA: visit `/roster/audit` → four rows visible (assign + status_change → ir + status_change → active + remove); filter by player narrows to just that player's rows
- [ ] Preview-deploy manual QA: season locked by admin → Add to Roster button disabled + banner visible + toast on any mutation attempt
- [ ] Vercel Analytics Explorer shows `roster_assign`, `roster_remove`, `roster_status_change`, `roster_limit_blocked` events from the preview deploy
- [ ] Convex migrations dashboard confirms `migrateDepthChartToRoster` has run against production data and reports `{scanned, copied, skipped}` summary

After flip, keep the flag on for ≥48h with analytics monitored before declaring Phase 1 shipped.

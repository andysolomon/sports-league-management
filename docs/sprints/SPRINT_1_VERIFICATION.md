# Sprint 1 — Phase 0 Roster Management — Verification Report

> **Status:** Code merged to `main` behind `depth_chart_v1` flag. Awaiting production flag flip (preview-deploy manual QA).
> **Closed (code):** 2026-04-22
> **Source plan:** `/Users/andrewsolomon/.claude/plans/lets-begin-dev-work-mighty-leaf.md`
> **Linear project:** Sprtsmng Roster Management (WSM-000002..WSM-000009)
> **Design spec:** [`docs/roster-management.md`](../roster-management.md) §1 (Phase 0 — LIVE), §11.1

Phase 0 delivers the minimum differentiator from the design doc Q7 working
assumption: **per-team, per-season depth-chart drag-reorder + season-level
edit lock.** Eight stories shipped as eight PRs, each cutting its own
semantic-release bump (all `feat:` or `docs:`).

## Criteria Matrix

| # | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| 1 | `depth_chart_v1` flag declared with `pageGuard` / `apiGuard` | `apps/web/src/lib/flags.ts` + unit suite `apps/web/src/lib/__tests__/flags.test.ts` | ✓ |
| 2 | `.well-known/vercel/flags` discovery endpoint returns flag metadata | `apps/web/src/app/.well-known/vercel/flags/route.ts` uses `createFlagsDiscoveryEndpoint` + `getProviderData` | ✓ |
| 3 | `seasons.rosterLocked` persisted; `depthChartEntries` table indexed on `(team,season)` and `(team,season,position)` | `apps/web/convex/schema.ts` | ✓ |
| 4 | One-shot backfill for pre-existing seasons | `apps/web/convex/migrations/20260422_seasonsRosterLocked.ts` | ✓ |
| 5 | `reorderDepthChart` rejects locked seasons with `season_locked` | `apps/web/convex/__tests__/depthChart.test.ts` — "rejects when the season is locked" | ✓ |
| 6 | `reorderDepthChart` rejects players that don't belong to the team with `player_not_on_team` | `apps/web/convex/__tests__/depthChart.test.ts` — "rejects a player that belongs to a different team" | ✓ |
| 7 | `reorderDepthChart` writes dense, zero-indexed `sortOrder` per `(team,season,positionSlot)` | `apps/web/convex/__tests__/depthChart.test.ts` — "assigns dense zero-indexed sortOrder" + "replaces existing entries on re-order" | ✓ |
| 8 | `setRosterLocked` toggle mutation shipped | `apps/web/convex/sports.ts` + test "toggles rosterLocked on the season" | ✓ |
| 9 | Depth-chart route renders behind `pageGuard(depthChartV1)`; 404 when flag off | `apps/web/src/app/dashboard/teams/[id]/depth-chart/page.tsx` line 21 | ✓ |
| 10 | Server actions enforce flag + Clerk org membership; admin-only for lock toggle | `apps/web/src/app/dashboard/teams/[id]/depth-chart/actions.ts` | ✓ |
| 11 | Drag-reorder UI with optimistic update + snap-back on error | `apps/web/src/components/depth-chart/PositionColumn.tsx` (arrayMove + useTransition + sonner toast) | ✓ |
| 12 | Three analytics events emitted with documented property shape | `apps/web/src/lib/analytics.ts` — `flag_exposure`, `depth_chart_reorder`, `season_lock_toggle` | ✓ |
| 13 | E2E smoke verifies flag-gated route is reachable | `apps/web/e2e/tests/coach-depth-chart.spec.ts` — "flag-gated route is reachable in dev" | ✓ |
| 14 | Seed-dependent E2E scenarios parked as `test.fixme` with TODOs | Same spec — 3× `test.fixme` blocks | ✓ |
| 15 | All pre-existing Vitest suites still pass (191/191) | `pnpm --filter @sports-management/web test:unit` | ✓ |
| 16 | Type-check + lint clean after every story | `pnpm --filter @sports-management/web type-check`, `pnpm --filter @sports-management/web lint` | ✓ |
| 17 | Production build succeeds with depth-chart route registered | `pnpm --filter @sports-management/web build` shows `/dashboard/teams/[id]/depth-chart   18.8 kB` | ✓ |
| 18 | Production flag flip completed | Vercel Flags UI — `depth_chart_v1` = `on` in production for ≥48h, analytics monitored | ☐ pending preview QA |

## PR / Release Evidence

| Story | Branch | Expected bump |
| --- | --- | --- |
| WSM-000003 | `feat/WSM-000003-depth-chart-flag` | minor |
| WSM-000004 | `feat/WSM-000004-depth-chart-schema` | minor |
| WSM-000005 | `feat/WSM-000005-depth-chart-mutations` | minor |
| WSM-000006 | `feat/WSM-000006-depth-chart-ui` | minor |
| WSM-000007 | `feat/WSM-000007-depth-chart-e2e` | minor |
| WSM-000008 | `feat/WSM-000008-depth-chart-analytics` | minor |
| WSM-000009 | `feat/WSM-000009-phase-0-docs` | no bump (`docs:`) |

WSM-000002 (spike) was folded into WSM-000006 — no scratch page was ever merged; the spike decisions (package choice, optimistic update shape) are recorded in `docs/roster-management.md` §11.1.

## Deferred / Follow-ups (not Phase 0 scope)

1. **Full E2E coverage** — drag-reorder and lock-enforcement specs are parked behind a Convex seeding harness + second Clerk test user.
2. **Vercel Flags provider adapter** — currently `decide()` is static (`NODE_ENV !== "production"`). Adapter lands once `FLAGS` env var is provisioned.
3. **Salesforce mirror** — `DepthChartEntry__c` / `RosterAssignment__c` Salesforce objects are Phase 2 per `docs/roster-management.md` §4.3.
4. **Phase 1 migration path** — `depthChartEntries.sortOrder` is deliberately kept semantically identical to what `rosterAssignments.depthRank` will become in WSM-000019; that story is a column rename, not a data reshape.

## Flag-flip checklist

Do **not** flip `depth_chart_v1` to `on` in production until all of the following are checked:

- [ ] Preview-deploy manual QA: sign in as coach, reorder QB depth chart, refresh → order persists
- [ ] Preview-deploy manual QA: sign in as admin, lock roster, switch back to coach account → banner visible, drag handles disabled
- [ ] Preview-deploy manual QA: admin unlocks → coach can drag again
- [ ] Vercel Analytics Explorer shows `depth_chart_reorder`, `season_lock_toggle`, `flag_exposure` events from the preview deploy
- [ ] Convex migrations dashboard confirms `backfillSeasonsRosterLocked` has run against production data

After flip, keep the flag on for ≥48h with analytics monitored before declaring Phase 0 shipped.

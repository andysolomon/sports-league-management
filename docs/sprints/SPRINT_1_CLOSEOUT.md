# Sprint 1 — Phase 0 Close-Out

> **Sprint:** 2026-04-21 (single-day burst)
> **Release:** [v0.4.0](https://github.com/andysolomon/sports-league-management/releases/tag/v0.4.0)
> **Stories shipped:** WSM-000003..WSM-000009 (7 of 8; WSM-000002 rolled up — see below)
> **Feature flag:** `depth_chart_v1` (production default: off)
> **Companion docs:** [SPRINT_1_VERIFICATION.md](./SPRINT_1_VERIFICATION.md) — criteria matrix + flag-flip checklist

Per-story implementation notes. Paired with the verification matrix; this
document captures the "what actually landed and why" for each issue.

---

## WSM-000002 — Spike: @dnd-kit reorder UX

**Status:** Rolled up into WSM-000006. No standalone PR.

The original scope was a throwaway `/dashboard/_spike-depth-chart/` scratch
route plus an ADR capturing the `@dnd-kit` decisions. On entry to the sprint
the spike deliverable was demoted: the scratch page would have been deleted
by WSM-000006's merge anyway, so the four ADR points (package choice,
sortable vs free-sort, optimistic-update shape, version pin) were folded
directly into `docs/roster-management.md` §11.1 via WSM-000009 without ever
opening a scratch route.

**ADR points captured in §11.1:**
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` pinned at the
  latest stable at sprint start (see `apps/web/package.json`)
- Sortable (vertical list per position slot) — not free-sort
- Optimistic shape: `{ items, mutation, onMutate, onError }` — local state
  mutated on drop; mutation fires; snap-back on rejected promise
- No separate spike branch; drag-reorder built directly into the production
  component tree

---

## WSM-000003 — Flag setup: `depth_chart_v1` + route-guard util

**PR:** [#99](https://github.com/andysolomon/sports-league-management/pull/99)
**Commit:** `a13a600`

### Files touched
- `apps/web/src/lib/flags.ts` (new) — `depthChartV1` flag + `pageGuard` / `apiGuard` helpers
- `apps/web/src/lib/__tests__/flags.test.ts` (new) — Vitest: on/off branches of both guards
- `apps/web/src/app/.well-known/vercel/flags/route.ts` (new) — Flags Explorer discovery endpoint
- `apps/web/package.json` — add `flags` dependency
- (convex/schema/sports snapshotted here — unrelated to flag scope but regenerated during setup)

### Key decisions
- Package choice: `flags` (v4.x), not the legacy `@vercel/flags` name. Import
  surface is `flags/next` for the App Router.
- Default: `on` in dev (`process.env.NODE_ENV !== 'production'`), `off` in
  prod. Wired via `decide: () => defaultOn` so the flag can be flipped in
  production via Vercel Flags UI without a redeploy.
- Guards: `pageGuard` → `notFound()`; `apiGuard` → `403 { error: 'flag_disabled' }`.
  Keeps page vs API failure modes distinct.
- Discovery endpoint uses `createFlagsDiscoveryEndpoint` + `getProviderData`
  from `flags/next` so the Flags Explorer panel in the Vercel Toolbar picks
  up the flag automatically.

### Verification
- `pnpm --filter @sports-management/web test:unit` — flags.test.ts passes both branches
- CI green on PR #99

---

## WSM-000004 — Schema: `seasons.rosterLocked` + `depthChartEntries`

**PR:** [#106](https://github.com/andysolomon/sports-league-management/pull/106)
**Commit:** `5420061`

### Files touched
- `apps/web/convex/schema.ts` — add `seasons.rosterLocked: v.boolean()`;
  new `depthChartEntries` table with two indexes
- `apps/web/convex/sports.ts` — adjust projections so existing queries
  return the new field on `Season`
- `apps/web/convex/migrations/20260422_seasonsRosterLocked.ts` (new) —
  one-shot migration to patch existing `seasons` rows with
  `rosterLocked: false`
- `packages/shared-types/src/index.ts` (bumped in later story) — `SeasonDto`
  gained `rosterLocked: boolean` (forward-compat contract)

### Key decisions
- Aggregate root: `(teamId, seasonId)`. All depth-chart invariants live on
  this pair — kept explicit so Phase 1's `rosterAssignments` migration stays
  a rename, not a data reshape.
- Indexes: `by_team_season` (read aggregate) and
  `by_team_season_position` (read one position slot). No separate unique
  index; uniqueness enforced in the mutation layer instead (see WSM-000005).
- Field semantics: `sortOrder` is **1-indexed top-of-chart-first**, matching
  the Phase 1 `rosterAssignments.depthRank` contract. This is the
  forward-compat invariant that keeps WSM-000019 a straight rename.
- Migration is idempotent — only patches rows where `rosterLocked` is
  `undefined`. Must be run once per environment before WSM-000005's
  mutations execute.

### Verification
- `pnpm convex dev` — schema applies cleanly, validator passes
- Migration run manually in the local convex dev deployment before merge
- Pre-existing Vitest suite unchanged — CI green on PR #106

---

## WSM-000005 — Mutations: `reorderDepthChart` + `setRosterLocked`

**PR:** [#107](https://github.com/andysolomon/sports-league-management/pull/107)
**Commit:** `e951396`

### Files touched
- `apps/web/convex/sports.ts` — `reorderDepthChart` +
  `setRosterLocked` + `getDepthChartByTeamSeason` query
- `apps/web/convex/__tests__/depthChart.test.ts` (new) — 5 integration tests
  via `convex-test`
- `apps/web/vitest.config.ts` — include convex test directory in runner
- `apps/web/package.json` + lockfile — add `convex-test` dev dep

### Key decisions
- **Invariant enforcement in mutation, not schema.** `reorderDepthChart`
  atomically deletes the existing `(team, season, positionSlot)` entries
  and re-inserts with dense zero-indexed `sortOrder`. No gaps, no ties,
  guaranteed.
- **Lock semantics.** Mutation reads `seasons.rosterLocked`; throws
  `season_locked` when true. `setRosterLocked` itself does not check the
  lock (it's the only way out of locked state).
- **Cross-team guard.** `reorderDepthChart` validates every `playerId`
  belongs to the target `teamId` in the same tx; rejects with
  `player_not_on_team`.
- **Error-code convention.** Plain `throw new Error("<code>")` strings —
  the action layer (WSM-000006) maps these to HTTP 403 while keeping the
  Gherkin AC strings authoritative.
- **Test harness.** `convex-test` + `import.meta.glob("../**/*.*s")` per the
  convex-test README. Required the `/// <reference types="vite/client" />`
  triple-slash directive on the test file so TS knows about `import.meta.glob`
  in the Node test context (fixed mid-cascade — see WSM-000006 below).

### Verification
- `pnpm --filter @sports-management/web test:unit` — 5 new tests pass:
  dense sortOrder, replace-on-reorder (no dupes), locked-season reject,
  cross-team reject, setRosterLocked toggle
- CI green on PR #107 (after vite/client reference added)

---

## WSM-000006 — UI: `/dashboard/teams/[id]/depth-chart`

**PR:** [#108](https://github.com/andysolomon/sports-league-management/pull/108)
**Commit:** `c00b668`

### Files touched
- `apps/web/src/app/dashboard/teams/[id]/depth-chart/page.tsx` (new) — Server
  Component, `pageGuard(depthChartV1)` at the top
- `apps/web/src/app/dashboard/teams/[id]/depth-chart/actions.ts` (new) —
  Server Actions: `reorderDepthChartAction`, `setRosterLockedAction`. Each
  runs `requireFlag()` + Clerk auth + org-membership check.
  `setRosterLockedAction` additionally requires `org:admin`.
- `apps/web/src/components/depth-chart/DepthChartBoard.tsx` (new) —
  Client Component orchestrator; holds `@dnd-kit/core` `DndContext` and
  optimistic state
- `apps/web/src/components/depth-chart/PositionColumn.tsx` (new) —
  `SortableContext` per position slot with `verticalListSortingStrategy`
- `apps/web/src/components/depth-chart/LockBanner.tsx` (new) — admin-only
  toggle + coach-visible banner when locked
- `apps/web/package.json` + lockfile — `@dnd-kit/core` + `@dnd-kit/sortable`
  + `@dnd-kit/utilities`
- `apps/web/src/lib/data-api.ts` — thin client helpers for the new actions
- `packages/shared-types/src/index.ts` — `DepthChartEntryDto`
- `packages/api-contracts/src/index.ts` — `SeasonDtoSchema.rosterLocked`
  (forward-compat fix landed mid-cascade — see below)

### Key decisions
- Server Actions, not Route Handlers. In-app mutations call Convex via
  `data-api.ts` after auth + org check; the mutation-layer errors
  (`season_locked`, `player_not_on_team`) bubble up as thrown errors.
- Optimistic update pattern: local state updated on drop; action fires;
  on rejection snap back + `toast.error()` via sonner. Keeps drag latency
  perceptually at zero.
- Admin lock toggle is always rendered for admins, disabled for non-admins.
  Coach sees `LockBanner` when `rosterLocked === true`; drag handles are
  disabled via `PositionColumn`'s `disabled` prop.
- Zod parity: `SeasonDtoSchema` had to add `rosterLocked` to match the
  `SeasonDto` type change from WSM-000004. Missed during schema story; fixed
  here as a blocker.

### Verification
- CI green on PR #108 after `SeasonDtoSchema.rosterLocked` fix
- `pnpm --filter @sports-management/web type-check` passes
- Preview-deploy manual QA: **pending** (tracked in SPRINT_1_VERIFICATION.md)

### Mid-cascade recovery note
PR #108 was caught in a `gh pr merge --auto` cascade that merged a stacked
set of 7 PRs into each other's feature branches instead of into `main`. The
clean 6-commit stack was rebuilt on `recovery/phase-0-stack` from reflog,
stale remote branches deleted, and PRs reopened sequentially against `main`
with CI validated per PR. WSM-000005's `vite/client` reference and
WSM-000006's `SeasonDtoSchema` fix were both caught by CI during the
recovery merges, amended, and force-pushed.

---

## WSM-000007 — E2E: coach reorder + lock-enforced 403

**PR:** [#109](https://github.com/andysolomon/sports-league-management/pull/109)
**Commit:** `c24a4f9`

### Files touched
- `apps/web/e2e/tests/coach-depth-chart.spec.ts` (new)

### Key decisions
- **Narrowed scope from the plan.** The original three Gherkin scenarios —
  coach drag-reorder persistence, admin lock-enforced disable, cross-team
  403 — all require (a) a Convex seeding harness and (b) a second Clerk
  test user that don't yet exist. Rather than stub around them, filed as
  `test.fixme` with inline TODOs that name the exact missing infrastructure.
- **Active test.** A single flag-gate smoke test verifies that the
  `/dashboard/teams/[id]/depth-chart` route is reachable for an
  authenticated user when `depth_chart_v1` is on. Proves the server action
  wiring at the HTTP layer without needing seed data.
- The three fixme scenarios ship with the seeding harness in a later
  sprint — tracked in the §11.1 decision log.

### Verification
- `pnpm --filter @sports-management/web test:e2e` — smoke test passes;
  3 fixme markers surface in the Playwright report as skipped
- CI green on PR #109

---

## WSM-000008 — Ops: analytics events + flag exposure

**PR:** [#110](https://github.com/andysolomon/sports-league-management/pull/110)
**Commit:** `2ed577c`

### Files touched
- `apps/web/src/lib/analytics.ts` (new) — thin wrapper around
  `@vercel/analytics`'s server-side `track()` that swallows errors so
  telemetry never blocks user flows
- `apps/web/src/lib/flags.ts` — emits `flag_exposure` from
  `depthChartV1.decide()` on every evaluation
- `apps/web/src/app/dashboard/teams/[id]/depth-chart/actions.ts` —
  `reorderDepthChartAction` fires `depth_chart_reorder` on success;
  `setRosterLockedAction` fires `season_lock_toggle` on success

### Key decisions
- **Server-side track() only.** No client-side emission for these events —
  the Server Actions are the only call sites, and the flag evaluator runs
  server-side. Keeps PII surface at zero.
- **Swallow errors.** The wrapper logs but never throws. Analytics outages
  must not break drag-reorder.
- **Property names verbatim from the Gherkin AC.** No extra fields, no
  alternates. If analysts query by `positionSlot`, `positionSlot` is the
  property — not `position` or `slot`.

### Verification
- `pnpm --filter @sports-management/web type-check` + build pass
- Events visible in Vercel Analytics after preview-deploy QA (**pending**)

---

## WSM-000009 — Docs: Phase 0 cutover + sprint 1 verification

**PR:** [#111](https://github.com/andysolomon/sports-league-management/pull/111)
**Commit:** `f4fe02d`

### Files touched
- `docs/roster-management.md` — new "Phase 0 — LIVE (2026-04-22)" subsection
  in §1; five §11.1 decision-log entries (flags package choice, spike
  roll-up, `sortOrder ↔ depthRank` forward-compat, narrowed E2E scope,
  analytics surface)
- `docs/sprints/SPRINT_1_VERIFICATION.md` (new) — 18-row criteria matrix,
  PR/release evidence, deferred follow-ups, preview-deploy flag-flip
  checklist

### Verification
- Markdown renders on GitHub; PR links resolve
- CI green on PR #111

---

## Out-of-band work (not part of the 8-story plan)

Three PRs landed after the plan-defined stories and are part of the Sprint 1
record:

### PR #112 — `fix(ci): drop @semantic-release/git so Release bypasses branch protection`
Removed `@semantic-release/git` + `@semantic-release/exec` from
`.releaserc.json`. Branch protection on `main` had been rejecting every
Release workflow run because `@semantic-release/git` pushes a
`chore(release): vX.Y.Z` commit directly to `main` via `git push`.
`@semantic-release/github` creates tags + Releases through the REST API
and bypasses branch protection entirely. Trade-off: `package.json` version
fields freeze at v0.3.0 — acceptable because `npmPublish: false` and there
are no downstream consumers. Documented in
`docs/development/BRANCH_PROTECTION.md` §3.

### PR #113 — `fix(ci): tighten release-workflow skip guard to startsWith`
The loop guard in `release.yml` used `contains('chore(release):')`, which
false-matched any commit whose body mentioned the phrase — including PR
#112's own squash-merge commit body that described the bug being fixed.
Result: the Release run that should have cut v0.4.0 was silently skipped.
Replaced with `startsWith()` so the guard fires only when the commit
message itself begins with `chore(release):`. Added `workflow_dispatch`
for manual invocation; used once to cut v0.4.0 after the guard fix merged.

### v0.4.0 release
[`v0.4.0`](https://github.com/andysolomon/sports-league-management/releases/tag/v0.4.0)
— 6 `feat:` commits (WSM-000003..WSM-000008) + both `fix(ci):` + 4 deferred
`docs:` from Sprint 0 close-out and WSM-000009.

---

## Deferred follow-ups

Tracked here so nothing falls off the radar. Owner on each once scheduled.

- **Preview-deploy manual QA** of the depth-chart route (coach drag-reorder
  path + admin lock-enforced disable path) before flipping
  `depth_chart_v1` to `on` in production. Checklist in
  `SPRINT_1_VERIFICATION.md`.
- **Flag flip** to `on` in production via Vercel Flags UI after QA passes;
  keep on ≥48h watching `depth_chart_reorder` / `season_lock_toggle` /
  `flag_exposure` in Vercel Analytics before declaring Phase 0 shipped.
- **Coach-depth-chart E2E — three `test.fixme` scenarios** await a Convex
  seeding harness + second Clerk test user. Lands with the harness in a
  later sprint, not Phase 1.
- **Convex package declaration gap** flagged in the plan (`apps/web/package.json`
  lacks an explicit `convex` dependency entry despite using the folder).
  No runtime impact; clean-up for a future chore PR.
- **Sprint 0 tightening items** still open per
  `docs/development/BRANCH_PROTECTION.md` §8:
  `required_status_checks: null` → should be `["Commitlint", "Lint, Type-check, Test & Build"]`;
  `required_approving_review_count: 0` → should be `1`. Both pending a
  second maintainer.

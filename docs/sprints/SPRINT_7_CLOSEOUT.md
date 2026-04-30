# Sprint 7 — Phase 3 (Schedules & Standings) Close-Out

> **Sprint:** 2026-04-29 (single-day burst, immediately after Sprint 6B)
> **Companion docs:** [SPRINT_7_VERIFICATION.md](./SPRINT_7_VERIFICATION.md) — criteria matrix + locked decisions
> **Stories shipped:** WSM-000066..WSM-000075 (10 PRs)
> **Feature flag:** `schedules_standings_v1` (production default: off)

Phase 3 delivers per-season fixtures, per-fixture game results, computed standings (org + public), an admin schedule + result entry surface, e2e coverage, and analytics. All ten stories landed as separate PRs.

Per-story implementation notes below.

---

## WSM-000066 — Schema: `fixtures` + `gameResults`

**PR:** #166

### Files touched
- `apps/web/convex/schema.ts` — two new tables with indexes (`by_seasonId`, `by_seasonId_week`, `by_homeTeamId`, `by_awayTeamId`, `by_fixtureId`)
- `packages/shared-types/src/index.ts` — `FixtureDto`, `GameResultDto`, `Standing`

### Key decisions
- `scheduledAt` + `week` nullable for TBD entries.
- `gameResults.playerStatsJson` reserved for Phase 4 — null in v1.
- `Standing.extended?: Record<string, number>` carved out as the same Phase 4 hook.

---

## WSM-000067 — Flag: `schedules_standings_v1`

**PR:** #167

### Files touched
- `apps/web/src/lib/flags.ts`
- `apps/web/src/lib/__tests__/flags.test.ts`

### Key decisions
- Same shape as `playerAttributesV1` from Sprint 6B; same `pageGuard` / `apiGuard` helpers work unchanged.

---

## WSM-000068 — Fixture mutations + queries

**PR:** #168

### Files touched
- `apps/web/convex/sports.ts` — `createFixture`, `updateFixture`, `deleteFixture`, `listFixturesBySeason`, `getFixture`
- `apps/web/src/lib/data-api.ts` — wrappers + `CreateFixtureInput`

### Key decisions
- `createFixture` validates `homeTeamId !== awayTeamId` + that both teams belong to the same league as the season's `leagueId`.
- `deleteFixture` cascades to the matching `gameResults` row in the same transaction.
- Team-name hydration happens in the queries so callers don't fan out for it.

---

## WSM-000069 — Result mutation + per-fixture read

**PR:** #169

### Files touched
- `apps/web/convex/sports.ts` — `recordGameResult`, `getResultByFixture`
- `apps/web/src/lib/data-api.ts` — wrappers + `RecordGameResultInput`

### Key decisions
- `recordGameResult` is idempotent: re-recording replaces the existing row via `db.replace`.
- Same transaction patches the parent fixture's `status: "final"` so the standings query picks it up immediately.

---

## WSM-000070 — Standings compute + tiebreaker math

**PR:** #170

### Files touched
- `apps/web/convex/lib/standings.ts` — pure `computeStandingsPure` function
- `apps/web/convex/sports.ts` — `computeStandings`, `computeDivisionStandings` queries
- `apps/web/src/lib/data-api.ts` — wrappers
- `apps/web/src/lib/__tests__/compute-standings.test.ts` — 10 cases

### Key decisions
- Pure function isolated from Convex `db` so the tiebreaker chain is unit-testable directly.
- League-wide ordering drives `leagueRank`; per-division ordering uses the same comparator.
- Division ranks are assigned across the full sort even when a `divisionFilter` shrinks the output rows — preserves the league-wide story while letting callers slice the table.

---

## WSM-000071 — Schedule UI (org-gated)

**PR:** #171

### Files touched
- `apps/web/src/app/dashboard/leagues/[id]/schedule/page.tsx`
- `apps/web/src/app/dashboard/leagues/[id]/schedule/actions.ts`
- `apps/web/src/components/schedule/FixtureFormDialog.tsx`
- `apps/web/src/components/schedule/RecordResultDialog.tsx`
- `apps/web/src/app/dashboard/leagues/[id]/page.tsx` — added Schedule + Standings links to the admin block

### Key decisions
- Schedule grouped by week with an "Unscheduled" bucket at the end (null week).
- "Record result" trigger label flips to "Edit result" when a result already exists; the dialog pre-fills via `getResultByFixture`.
- Server actions return `{ ok, error? }` discriminated unions instead of throwing — dialogs map known codes to friendly toast copy.
- Folded in the missed `lib_standings` codegen artifact from PR #170 to keep type-checks clean across deployments.

---

## WSM-000072 — Standings UI (org-gated)

**PR:** #172

### Files touched
- `apps/web/src/app/dashboard/leagues/[id]/standings/page.tsx`
- `apps/web/src/components/schedule/StandingsTable.tsx`

### Key decisions
- Picks the league's active season as default; first-available fallback.
- Single 8-bit table: Rank | Team | W | L | T | PF | PA | +/− | Div Rank.
- `StandingsTable` lives in `components/schedule/` so the public viewer reuses identical markup with zero divergence.

---

## WSM-000073 — Standings UI (public)

**PR:** #173

### Files touched
- `apps/web/src/app/leagues/[id]/standings/page.tsx`
- `apps/web/convex/sports.ts` — `computeStandingsPublic` query
- `apps/web/src/lib/data-api.ts` — wrapper

### Key decisions
- Two-layer defense: `publicLeagueGuard` (page) + `computeStandingsPublic` (query) both enforce `league.isPublic`.
- The new query packages the active-season pick and the standings rows into one round-trip — `{ seasonName, rows }` — so the page doesn't need a second hop to label the season.
- Middleware already whitelists `/leagues/(.*)` from WSM-000061 — no middleware change.

---

## WSM-000074 — E2E coverage

**PR:** #174

### Files touched
- `apps/web/e2e/tests/schedules-standings.spec.ts`
- `apps/web/e2e/helpers/seed-schedule.ts`
- `apps/web/convex/e2eSeed.ts` — new `createScheduleFixture` mutation + extended `deleteFixtureByKey` to cascade through fixtures + gameResults

### Key decisions
- Two scenarios in a single `describe.serial` block share one fixture (matches the WSM-000064 pattern).
- Seed harness exposes a `withScheduleFixture` helper — same shape as `withRosterFixture` so future schedule-related specs slot in unchanged.
- CI doesn't run Playwright by design (consistent with WSM-000064); local + preview verification before flag flip.

---

## WSM-000075 — Analytics + docs + closeout

**PR:** this PR

### Files touched
- `apps/web/src/lib/analytics.ts` — `trackFixtureCreated`, `trackResultRecorded`, `trackStandingsView`
- `apps/web/src/app/dashboard/leagues/[id]/standings/page.tsx` + `apps/web/src/app/leagues/[id]/standings/page.tsx` — fire-and-forget view event
- `apps/web/src/app/dashboard/leagues/[id]/schedule/actions.ts` — fire-and-forget create + record events
- `docs/roster-management.md` — Phase 3 — LIVE row appended to §1
- `docs/sprints/SPRINT_7_VERIFICATION.md` (new)
- `docs/sprints/SPRINT_7_CLOSEOUT.md` (this file)

---

## Running baseline at sprint close

- `pnpm --filter @sports-management/web type-check` — clean
- `pnpm --filter @sports-management/web lint` — one pre-existing warning, no new
- `pnpm --filter @sports-management/web test:unit` — **267 passed** (was 257 at Sprint 6B close; +10 from `compute-standings.test.ts`)
- `pnpm exec playwright test --grep WSM-000074` — runs against local Convex + dev server (same flow as Sprint 6B's WSM-000064)

## Where Sprint 8 picks up

The product roadmap from `docs/roster-management.md` §5 is now fully shipped behind flags. Natural Sprint 8 candidates:

- **Soak-and-cleanup sprint** — `middleware.ts` → `proxy.ts` migration (Next 16), visual regression for `PixelLineChart` + `StandingsTable`, public viewer landing page polish, address any prod issues that surface from the Phase 2/3 flag flips.
- **Phase 4 — per-player stat rollups** — wire `gameResults.playerStatsJson` into `playerAttributes` automatically post-game. Closes the loop between Phase 3's results and Phase 2's development charts.
- **Live PFF/Madden integration** — wire actual feeds into the adapters from WSM-000056. Smaller scope (~3 stories) but requires business decisions on credentials/licensing.
- **Phase 3.5 polish** — CSV bulk fixture upload + coach-submitted-pending-approval workflow + public schedule view. The deferred items from Sprint 7's locked-decision grill.

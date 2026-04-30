# Sprint 7 — Phase 3 (Schedules & Standings) — Verification Report

> **Status:** Code merged to `main` behind `schedules_standings_v1` flag. Awaiting preview-deploy manual QA + analytics verification before prod flag flip.
> **Closed (code):** 2026-04-29
> **Source plan:** `~/.claude/plans/lets-begin-dev-work-mighty-leaf.md` (10 stories WSM-000066..075).
> **Anchor:** new `fixtures` + `gameResults` tables on Convex; `computeStandings` is computed-on-read (no derived table).

## Locked decisions

| # | Question | Resolution |
|---|---|---|
| 1 | Fixture entry — manual one-at-a-time or CSV bulk? | Manual one-at-a-time only. CSV deferred to Phase 3.5. |
| 2 | Public surface — both schedule + standings, or standings only? | Standings only public. Schedule stays org-gated. Reuses WSM-000059's `publicLeagueGuard`. |
| 3 | Result entry permissions — admin-only, or coach-submits-pending-approval? | Admin-only in v1. Coach workflow deferred. |
| 4 | Standings storage — derived table or computed-on-read? | Computed-on-read with React `cache()` per-request memoization. Revisit if any league grows past ~500 fixtures. |
| 5 | Tiebreaker order | wins desc → head-to-head → division win % → points differential desc → team name asc. Locked verbatim from `docs/roster-management.md` §5.4. |
| 6 | `gameResults.playerStatsJson` parser | Reserved as `string \| null`; null in v1. Phase 4 will define the parser. |

## Criteria Matrix

| # | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| 1 | `fixtures` + `gameResults` tables + indexes | `apps/web/convex/schema.ts` — `by_seasonId`, `by_seasonId_week`, `by_homeTeamId`, `by_awayTeamId`, `by_fixtureId` | ✓ |
| 2 | `schedules_standings_v1` flag declared with `pageGuard` / `apiGuard` parity | `apps/web/src/lib/flags.ts` + `flags.test.ts` cases | ✓ |
| 3 | `createFixture` validates same-team + cross-league before insert | `convex/sports.ts` + `data-api.ts` wrapper | ✓ |
| 4 | `deleteFixture` cascades to `gameResults` row | `convex/sports.ts` | ✓ |
| 5 | `recordGameResult` idempotent on `(fixtureId)` + flips parent status to `final` in same transaction | `convex/sports.ts` | ✓ |
| 6 | `computeStandings` aggregates W/L/T + PF/PA from final fixtures with the full tiebreaker chain | `convex/lib/standings.ts` (pure) + `convex/sports.ts` (Convex query) | ✓ |
| 7 | `computeDivisionStandings` filters by division while preserving league-wide rank ordering | same | ✓ |
| 8 | `computeStandingsPublic` gates on `league.isPublic` (layered defense alongside `publicLeagueGuard`) | `convex/sports.ts` | ✓ |
| 9 | `/dashboard/leagues/[id]/schedule` renders per-week tables + admin dialogs (org-gated) | `apps/web/src/app/dashboard/leagues/[id]/schedule/page.tsx` | ✓ |
| 10 | `/dashboard/leagues/[id]/standings` renders single 8-bit standings table (org-gated) | `apps/web/src/app/dashboard/leagues/[id]/standings/page.tsx` | ✓ |
| 11 | `/leagues/[id]/standings` renders for the public when isPublic, 404s when private | `apps/web/src/app/leagues/[id]/standings/page.tsx` | ✓ |
| 12 | League detail page links to schedule + standings for admins | `apps/web/src/app/dashboard/leagues/[id]/page.tsx` | ✓ |
| 13 | E2E spec exercises create-fixture → record-result → standings → public-viewer toggle | `e2e/tests/schedules-standings.spec.ts` + `e2e/helpers/seed-schedule.ts` | ✓ |
| 14 | Analytics events emitted: `fixture_created`, `result_recorded`, `standings_view`, `flag_exposure` | `lib/analytics.ts` + standings pages + schedule actions | ✓ |
| 15 | Type-check + lint clean after every story | each PR's CI | ✓ |
| 16 | Unit tests still pass | 267/267 (incl. 10 new `compute-standings` cases) | ✓ |
| 17 | `docs/roster-management.md` Phase 3 — LIVE row appended | this PR | ✓ |
| 18 | Production flag flip completed | Vercel Flags UI — `schedules_standings_v1` = `on` ≥48h, analytics monitored | ☐ pending preview QA |

## PR / Release Evidence

| Story | Branch | PR | Expected bump |
| --- | --- | --- | --- |
| WSM-000066 | `feat/WSM-000066-phase3-schema` | #166 | minor |
| WSM-000067 | `feat/WSM-000067-phase3-flag` | #167 | minor |
| WSM-000068 | `feat/WSM-000068-fixture-crud` | #168 | minor |
| WSM-000069 | `feat/WSM-000069-result-crud` | #169 | minor |
| WSM-000070 | `feat/WSM-000070-standings-compute` | #170 | minor |
| WSM-000071 | `feat/WSM-000071-schedule-ui` | #171 | minor |
| WSM-000072 | `feat/WSM-000072-standings-ui-org` | #172 | minor |
| WSM-000073 | `feat/WSM-000073-standings-ui-public` | #173 | minor |
| WSM-000074 | `test/WSM-000074-phase3-e2e` | #174 | no bump (`test:`) |
| WSM-000075 | `feat/WSM-000075-phase3-closeout` | this PR | minor (`feat:` analytics) |

## Deferred / Sprint 7.5+ candidates

1. **CSV bulk fixture upload** — admin pastes a CSV → batch insert. Re-evaluate if admins complain about manual one-at-a-time entry.
2. **Coach-submitted result with admin approval** — adds a `gameResults.status: "pending" | "approved"` column + workflow. Open question per design doc §11.
3. **Public schedule view** — easy mirror of WSM-000071's read query under `/leagues/[id]/schedule` with `publicLeagueGuard`.
4. **Per-player stats rollup** — `gameResults.playerStatsJson` is reserved but not parsed. Phase 4 territory; would feed `playerAttributes` automatically post-game.
5. **Auto-generate schedule (round-robin)** — out of scope for v1.
6. **Visual regression for `StandingsTable`** — same Sprint-6B-deferred concern; bundle with the soak-and-cleanup sprint.
7. **`middleware.ts` → `proxy.ts` migration (Next 16)** — still flagged from Sprint 6B; out of scope here.

## Flag-flip checklist

Do **not** flip `schedules_standings_v1` to `on` in production until all of the following are checked:

- [ ] Preview-deploy manual QA: sign in as admin → open league schedule → click "New fixture" → pick two teams + week 1 → confirm row appears
- [ ] Preview-deploy manual QA: click "Record result" on the new row → enter scores → confirm fixture status flips to `final` + score visible
- [ ] Preview-deploy manual QA: open `/dashboard/leagues/[id]/standings` → confirm winner has W=1 + correct PF/PA + division/league rank
- [ ] Preview-deploy manual QA: hit `/leagues/[id]/standings` in incognito while league is private → confirm 404
- [ ] Preview-deploy manual QA: flip the league public on the league detail page → confirm public standings route now renders the same table
- [ ] Vercel Analytics Explorer shows `fixture_created`, `result_recorded`, `standings_view`, `flag_exposure(schedules_standings_v1)` events from the preview deploy
- [ ] Soak the flag at on for ≥48h with analytics monitored before declaring Phase 3 shipped

## Risks closed

- **Tiebreaker correctness** — `compute-standings.test.ts` covers head-to-head, division-record fallback, and points-differential fallback explicitly. Locked before any UI was wired.
- **Cascade delete of fixtures with results** — `deleteFixture` removes the matching `gameResults` row in the same transaction; standings can't double-count an orphan.
- **Compound-index typing under `mutationGeneric`** — pre-empted by using leading-field-only index lookup + filter (same workaround as `ingestPlayerAttributes` from Sprint 6B).
- **Public-leak risk** — `leagues.isPublic` is the single chokepoint; both `publicLeagueGuard` (page-level) and `computeStandingsPublic` (query-level) enforce it. Layered defense.
- **Convex codegen lag** — caught early via `pnpm exec convex dev --once` after every schema-touching commit; the missed `lib_standings` artifact from #170 was rolled into #171.

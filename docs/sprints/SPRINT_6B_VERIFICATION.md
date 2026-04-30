# Sprint 6B — Phase 2 (Player Attributes & Development) — Verification Report

> **Status:** Code merged to `main` behind `player_attributes_v1` flag. Awaiting preview-deploy manual QA + analytics verification before prod flag flip.
> **Closed (code):** 2026-04-29
> **Source plan:** SPRINT_3_CLOSEOUT.md outline (12 stories WSM-000054..065). Originally scoped as Sprint 4; deferred behind the 8-bit re-skin (Sprint 3) and the Salesforce decoupling (Sprint 5 + 6A). Now ships into a Convex-native, 8-bit-styled stack.
> **Anchor:** `playerAttributes` table on Convex with the existing `players` + `seasons` join surface. Three source adapters (PFF / Madden / admin-uploaded JSON) feed a single ingest mutation that computes weighted overall.

## Locked decisions

| # | Question | Resolution |
|---|---|---|
| 1 | Source data — admin-only or feed-ready? | Both. Three adapters: PFF / Madden / admin canonical JSON. v1 runs on admin pastes; live feeds are a future op. |
| 2 | Read access — org-gated or public? | Both. Org-gated `/dashboard/players/[id]/development` for the back-office, public `/leagues/[id]/players/[playerId]/development` for parents/fans. Public is opt-in per league via `leagues.isPublic`. |
| 3 | Position-group taxonomy — football-only? | Football-first. `POSITION_GROUPS = QB / RB / WR / TE / OL / DL / LB / DB / K / P` shared between adapters + the per-position UI. |
| 4 | Chart library — recharts or hand-rolled SVG? | Hand-rolled `PixelLineChart` SVG with `image-rendering: pixelated`. The polished anti-aliased look of recharts fights the 8-bit aesthetic from Sprint 3. |
| 5 | Public route URL shape | `/leagues/[id]/players/[playerId]/development` (id-based, no slug column). Matches the rest of the dashboard tree's id-first pattern. |
| 6 | Admin upload UX | Single textarea + source select (Admin / PFF / Madden). Same code path as the three adapters; smallest UI surface. |
| 7 | Weighted-overall formula on dual-source ingest | Per-attribute weighted average across surviving sources. Admin uploads use weight 1.0 (canonical); PFF + Madden default 0.5/0.5 (configurable per ingest). `weightedOverall` picks the canonical OVR-like key from the blended map. |

## Criteria Matrix

| # | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| 1 | `playerAttributes` table + indexes | `apps/web/convex/schema.ts` — `by_playerId_seasonId`, `by_seasonId_positionGroup` | ✓ |
| 2 | `player_attributes_v1` flag declared with `pageGuard` / `apiGuard` parity | `apps/web/src/lib/flags.ts` + flags.test.ts cases | ✓ |
| 3 | Three normalizers expose canonical `{ positionGroup, attributes }` | `apps/web/src/lib/attributes/sources/{pff,madden,admin-json}.ts` + per-adapter unit tests | ✓ |
| 4 | `ingestPlayerAttributes` mutation idempotent on `(playerId, seasonId)` | `convex/sports.ts` + `lib/__tests__/ingest-player-attributes.test.ts` | ✓ |
| 5 | Wrapper computes weighted overall from blended sources | `lib/data-api.ts ingestPlayerAttributes` + 5 unit-test cases | ✓ |
| 6 | `getPlayerDevelopment` returns season-ordered rows with deltas | `convex/sports.ts` + data-api wrapper | ✓ |
| 7 | `getSeasonAttributesByPosition` returns top-N for a position group | same | ✓ |
| 8 | `publicLeagueGuard` + `getPlayerDevelopmentPublic` gate the public viewer | `lib/public-league-guard.ts` + `__tests__/public-league-guard.test.ts` (3 cases) | ✓ |
| 9 | `/dashboard/players/[id]/development` renders chart + per-season table + admin upload (admin-only) | `apps/web/src/app/dashboard/players/[id]/development/page.tsx` | ✓ |
| 10 | `/leagues/[id]/players/[playerId]/development` renders for the public when isPublic, 404s when private | `apps/web/src/app/leagues/[id]/players/[playerId]/development/page.tsx` | ✓ |
| 11 | `/dashboard/seasons/[id]/attributes/[positionGroup]` renders ranked table + position-group nav | `apps/web/src/app/dashboard/seasons/[id]/attributes/[positionGroup]/page.tsx` | ✓ |
| 12 | League detail page exposes `Make public` toggle for org admins | `apps/web/src/app/dashboard/leagues/[id]/page.tsx` + `league-public-toggle.tsx` | ✓ |
| 13 | `setLeaguePublic` Convex mutation + server action | `convex/sports.ts` + `dashboard/leagues/[id]/actions.ts` | ✓ |
| 14 | E2E spec exercises ingest happy path + public-toggle gating | `e2e/tests/player-attributes.spec.ts` | ✓ |
| 15 | Analytics events emitted: `player_attributes_view`, `player_attributes_ingest`, `flag_exposure` | `lib/analytics.ts` + dev-page + ingest-action wiring | ✓ |
| 16 | Type-check + lint clean after every story | each PR's CI | ✓ |
| 17 | Unit tests still pass | 255/255 | ✓ |
| 18 | `docs/roster-management.md` Phase 2 — LIVE row appended | this PR | ✓ |
| 19 | Production flag flip completed | Vercel Flags UI — `player_attributes_v1` = `on` ≥48h, analytics monitored | ☐ pending preview QA |

## PR / Release Evidence

| Story | Branch | PR | Expected bump |
| --- | --- | --- | --- |
| WSM-000054 | `feat/WSM-000054-player-attributes-schema` | #154 | minor |
| WSM-000055 | `feat/WSM-000055-player-attributes-flag` | #155 | minor |
| WSM-000056 | `feat/WSM-000056-attribute-source-adapters` | #156 | minor |
| WSM-000057 | `feat/WSM-000057-ingest-player-attributes` | #157 | minor |
| WSM-000058 | `feat/WSM-000058-player-attributes-queries` | #158 | minor |
| WSM-000059 | `feat/WSM-000059-public-read-primitives` | #159 | minor |
| WSM-000060 | `feat/WSM-000060-development-chart-org` | #160 | minor |
| WSM-000061 | `feat/WSM-000061-development-chart-public` | #161 | minor |
| WSM-000062 | `feat/WSM-000062-position-attributes-table` | #162 | minor |
| WSM-000063 | `feat/WSM-000063-admin-upload-public-toggle` | #163 | minor |
| WSM-000064 | `feat/WSM-000064-attributes-e2e` | #164 | no bump (`test:`) |
| WSM-000065 | `feat/WSM-000065-sprint6b-closeout` | this PR | no bump (`docs:`) |

## Deferred / Sprint 7+ candidates

1. **Live PFF / Madden feed integrations** — adapters exist, but actual feed access (API keys, scraping rights, paid licenses) is a separate business decision. Today the system runs on admin pastes.
2. **Public viewer landing page** — the `/leagues/[id]/...` tree currently only exposes `/players/[playerId]/development` directly. A `/leagues/[id]` index page summarizing the league + linking to player charts would polish the public surface.
3. **Per-attribute weights** — current implementation has scalar `pffWeight + maddenWeight` shared across all attributes. Per-attribute weights (e.g. trust PFF more for QB accuracy, Madden more for OL strength) would need a richer mutation arg.
4. **Audit log for attribute ingest** — Phase 1 has `rosterAuditLog`. Phase 2 doesn't audit attribute writes; if compliance becomes a concern we'd add an `attributeIngestLog` table.
5. **Visual regression for `PixelLineChart`** — no Playwright screenshot tests yet. Consider during Sprint 7 if visual drift becomes a concern.
6. **Phase 3 — Schedules & Standings** per design doc §5.4 (`schedules_standings_v1` flag). Natural next sprint for product roadmap.

## Flag-flip checklist

Do **not** flip `player_attributes_v1` to `on` in production until all of the following are checked:

- [ ] Preview-deploy manual QA: sign in as admin → open a player's `/development` → click "Add attributes" → paste canonical JSON → confirm chart updates + table row appears
- [ ] Preview-deploy manual QA: open the league detail page → click "Make public" → confirm toggle flips + toast appears
- [ ] Preview-deploy manual QA: hit `/leagues/[id]/players/[id]/development` in an incognito window (no Clerk session) → confirm public chart renders
- [ ] Preview-deploy manual QA: flip the same league back to private → confirm public route 404s
- [ ] Vercel Analytics Explorer shows `player_attributes_view`, `player_attributes_ingest`, `flag_exposure(player_attributes_v1)` events from the preview deploy
- [ ] Soak the flag at on for ≥48h with analytics monitored before declaring Phase 2 shipped

## Risks closed

- **Aesthetic divergence** — the new chart was built native to the 8-bit aesthetic (hand-rolled `PixelLineChart`), avoiding the alternative cycle of "ship recharts, restyle later".
- **Salesforce coupling** — Sprint 6A removed every SF read path; Phase 2 ships into a clean Convex-only stack, so no SF dependency for ingest, queries, or public viewer.
- **Public-leak risk** — `leagues.isPublic` is the single chokepoint that gates the public viewer. Both `publicLeagueGuard` (page-level) and `getPlayerDevelopmentPublic` (query-level) enforce it; layered defense.
- **Mock divergence** — the ingest wrapper has 5 unit-test cases covering the source-blending + weighted-overall math, so future ingest changes can't silently regress the formula.

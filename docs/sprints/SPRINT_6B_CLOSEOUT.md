# Sprint 6B — Phase 2 (Player Attributes & Development) Close-Out

> **Sprint:** 2026-04-29 (single-day burst, immediately after Sprint 6A)
> **Companion docs:** [SPRINT_6B_VERIFICATION.md](./SPRINT_6B_VERIFICATION.md) — criteria matrix + locked decisions
> **Stories shipped:** WSM-000054..WSM-000065 (12 PRs)
> **Feature flag:** `player_attributes_v1` (production default: off)

Phase 2 delivers per-player per-season attribute snapshots, a development chart UI (org-gated + public mirror), a per-position top-N table, an admin upload flow, the `Make-public` toggle that gates the public viewer, e2e coverage, and analytics. All twelve stories landed as separate PRs.

Per-story implementation notes below.

---

## WSM-000054 — Schema: `playerAttributes` table

**PR:** #154

### Files touched
- `apps/web/convex/schema.ts` — new `playerAttributes` table with `by_playerId_seasonId` + `by_seasonId_positionGroup` indexes
- `packages/shared-types/src/index.ts` — `PlayerAttributeDto`

### Key decisions
- `attributesJson` stored as a string for forward-compat with arbitrary attribute keys; the read queries parse it server-side and return `Record<string, number>` so consumers don't repeat the work.
- `pffSourceJson` + `maddenSourceJson` (raw payloads) kept alongside the canonical `attributesJson` for future re-normalization without re-fetching from sources.
- `weightedOverall` nullable when no source carried an OVR-like attribute.

---

## WSM-000055 — Flag: `player_attributes_v1`

**PR:** #155

### Files touched
- `apps/web/src/lib/flags.ts` — new `playerAttributesV1` flag
- `apps/web/src/lib/__tests__/flags.test.ts` — added on/off + key + description cases

### Key decisions
- Same shape as `depth_chart_v1` and `roster_snapshots_v1` from prior phases. Same `pageGuard` / `apiGuard` helpers work unchanged.

---

## WSM-000056 — Source adapters

**PR:** #156

### Files touched
- `apps/web/src/lib/attributes/position-groups.ts` — canonical `POSITION_GROUPS` tuple + `isValidPositionGroup` type guard
- `apps/web/src/lib/attributes/sources/types.ts` — shared `NormalizedSource` shape
- `apps/web/src/lib/attributes/sources/{pff,madden,admin-json}.ts` — three normalizers
- `apps/web/src/lib/attributes/sources/__tests__/{pff,madden,admin-json}.test.ts` — happy-path + null-input + invalid-shape coverage

### Key decisions
- All three adapters return `null` (not throw) on malformed input — caller treats null as "skip this row".
- PFF + admin-JSON share the canonical shape `{ positionGroup, attributes: { ... } }`. Madden adapter handles the flat `{ POS, OVR, SPD, ... }` format and excludes id/name/team metadata fields.

---

## WSM-000057 — `ingestPlayerAttributes` mutation + wrapper

**PR:** #157

### Files touched
- `apps/web/convex/sports.ts` — `ingestPlayerAttributes` mutation
- `apps/web/src/lib/data-api.ts` — wrapper that runs the adapters + computes weighted overall + persists
- `apps/web/src/lib/__tests__/ingest-player-attributes.test.ts` — 5 unit-test cases

### Key decisions
- Normalization happens in the wrapper (client-side relative to Convex), not the mutation. Convex receives canonical pre-blended pieces. Keeps Convex code free of any source-format awareness.
- Idempotent upsert by `(playerId, seasonId)`. Looks up via leading-field-only index form to sidestep an `IndexRange` typing quirk under `mutationGeneric`.
- Weighted average is per-attribute across all surviving sources. Admin uploads use weight 1.0; PFF + Madden default 0.5/0.5.

---

## WSM-000058 — Read queries

**PR:** #158

### Files touched
- `apps/web/convex/sports.ts` — `getPlayerDevelopment` + `getSeasonAttributesByPosition`
- `apps/web/src/lib/data-api.ts` — wrappers

### Key decisions
- `getPlayerDevelopment` hydrates season info via `ctx.db.get` per row + sorts by `season.startDate` ASC. Per-row `delta` computed at query layer.
- `getSeasonAttributesByPosition` uses leading-field index lookup + filter, sorts by `weightedOverall` DESC, slices to limit (default 25). Hydrates `player.name`.
- `safeParseAttributes` helper drops non-finite numeric values, isolating the read path from future `attributesJson` schema drift.

---

## WSM-000059 — Public-read primitives

**PR:** #159

### Files touched
- `apps/web/convex/sports.ts` — `getLeagueVisibility` + `getPlayerDevelopmentPublic`
- `apps/web/src/lib/data-api.ts` — wrappers
- `apps/web/src/lib/public-league-guard.ts` — page-level guard
- `apps/web/src/lib/__tests__/public-league-guard.test.ts` — 3 cases

### Key decisions
- `getPlayerDevelopmentPublic` enforces both `league.isPublic === true` AND `player.leagueId === leagueId`. Returns `null` on either guard failure. Layered defense alongside the page-level guard.

---

## WSM-000060 — Org-gated dev chart UI + `PixelLineChart`

**PR:** #160

### Files touched
- `apps/web/src/components/attributes/PixelLineChart.tsx` — hand-rolled SVG chart
- `apps/web/src/app/dashboard/players/[id]/development/page.tsx`

### Key decisions
- No recharts. Hand-rolled SVG with `image-rendering: pixelated`, chunky 4px stroke, 10×10 filled-square vertices, palette tokens (`--color-primary`, `--color-card`, etc.). Inherits dark/light mode automatically.
- Skips null y values cleanly so a missing season doesn't break the line.
- Page layout: header (player name + position) → chart card with delta call-out → per-season table card.

---

## WSM-000061 — Public viewer route

**PR:** #161

### Files touched
- `apps/web/src/app/leagues/[id]/players/[playerId]/development/page.tsx`
- `apps/web/src/middleware.ts` — added `/leagues/(.*)` to `isPublicRoute`

### Key decisions
- Reuses `PixelLineChart` + the same headline/table layout as the dashboard variant. Stripped to `max-w-3xl` with no sidebar (route lives outside `/dashboard/`).
- Visibility enforced inside the page via `publicLeagueGuard`; middleware just doesn't gate on Clerk auth.
- Note: `middleware.ts` → `proxy.ts` migration (Next 16) flagged by post-tool validator. Out of scope; separate dedicated migration with runtime + response-shape changes.

---

## WSM-000062 — Per-position attributes table

**PR:** #162

### Files touched
- `apps/web/src/app/dashboard/seasons/[id]/attributes/[positionGroup]/page.tsx`

### Key decisions
- Validates the `[positionGroup]` URL slug against `POSITION_GROUPS` — unknown slug → 404.
- Position-group nav row at top: 10 chip-style links, active group highlighted via the chunky-border + `bg-primary` styling from Sprint 3.
- Player name links to the player's `/development` page (cross-link between the two views).

---

## WSM-000063 — Admin upload + Make-public toggle

**PR:** #163

### Files touched
- `apps/web/src/components/attributes/AttributesUploadDialog.tsx` — single textarea + source select + season select
- `apps/web/src/app/dashboard/players/[id]/development/actions.ts` — `ingestPlayerAttributesAction` (org:admin gated)
- `apps/web/convex/sports.ts` — `setLeaguePublic` mutation
- `apps/web/src/lib/data-api.ts` — `setLeaguePublic` wrapper
- `apps/web/src/app/dashboard/leagues/[id]/actions.ts` — `setLeaguePublicAction` (org:admin gated)
- `apps/web/src/app/dashboard/leagues/[id]/league-public-toggle.tsx` — admin-only toggle component
- `apps/web/src/app/dashboard/leagues/[id]/page.tsx` — wires the toggle into the existing admin sidebar block

### Key decisions
- `ingestPlayerAttributesAction` returns `{ ok, error? }` rather than throwing — the dialog maps known error codes to friendly toast messages.
- Upload modal uses the 8bit Dialog/Select/Textarea/Button primitives + sonner for feedback.

---

## WSM-000064 — E2E coverage

**PR:** #164

### Files touched
- `apps/web/e2e/tests/player-attributes.spec.ts`

### Key decisions
- Two scenarios in a single `describe.serial` block: (1) admin uploads canonical JSON → chart + table render the row; (2) league public toggle gates the public viewer route (private → 404; flip to public → renders).
- Reuses `withRosterFixture` + `signInTestUser` from WSM-000022+. Same env prerequisites — no new setup.
- Spec exercises the new playwright surface; runs against running Convex + dev server (same workflow as the WSM-000023+ specs). CI pipeline doesn't currently run Playwright; local + preview verification.

---

## WSM-000065 — Analytics + docs + closeout

**PR:** this PR

### Files touched
- `apps/web/src/lib/analytics.ts` — `trackPlayerAttributesView` + `trackPlayerAttributesIngest`
- `apps/web/src/app/dashboard/players/[id]/development/page.tsx` + `/leagues/[id]/players/[playerId]/development/page.tsx` — fire-and-forget view event
- `apps/web/src/app/dashboard/players/[id]/development/actions.ts` — fire-and-forget ingest event after success
- `docs/roster-management.md` — Phase 2 — LIVE row appended to §1
- `docs/sprints/SPRINT_6B_VERIFICATION.md` (new)
- `docs/sprints/SPRINT_6B_CLOSEOUT.md` (this file)

---

## Running baseline at sprint close

- `pnpm --filter @sports-management/web type-check` — clean
- `pnpm --filter @sports-management/web lint` — one pre-existing warning, no new
- `pnpm --filter @sports-management/web test:unit` — **255 passed** (no regression vs. Sprint 6A close)
- `pnpm exec playwright test --grep WSM-000064` — runs against local Convex + dev server (same flow as the prior roster e2e specs)

## Where Sprint 7 picks up

The product roadmap from `docs/roster-management.md` §5 has one phase remaining:

**Sprint 7 — Phase 3: Schedules & Standings** (`schedules_standings_v1` flag). Per design doc §5.4: admin creates `fixtures` manually + via CSV upload, enters results into `gameResults`, standings computed on read with configurable tiebreakers. ~10-12 stories.

Alternatives to consider before committing:
- **Soak-and-cleanup sprint** — `middleware.ts` → `proxy.ts` migration, visual regression coverage for the chart, public viewer landing page polish, address any prod issues that surface from the Phase 2 flag flip.
- **Live PFF/Madden integration** — wire actual feeds into the adapters from WSM-000056. Smaller scope (~3 stories) but requires business decisions on credentials/licensing.

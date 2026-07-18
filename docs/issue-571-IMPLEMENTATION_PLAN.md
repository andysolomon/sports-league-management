# Issue #571 — Replace breadcrumbs with reusable Resource Headers

## Goal
Replace breadcrumb trails and destination-generated "Back to …" rows with a
reusable Resource Header on every League, Team, Player, and Season page, and
add the dashboard's history Back control. Restore the work that PR #580
claimed to ship but did not.

## Phase 1 — Shared primitives
- `apps/web/src/components/workspace/ResourceHeader.tsx` — presentational
  header with `data-testid="resource-header-{kind}"`, sibling nav with
  `aria-current="page"`, optional status/context/actions slots, no
  breadcrumbs or back-link affordances.
- `apps/web/src/components/workspace/resource-navigation.ts` — pure
  `leagueHomeHref`, `teamHomeHref`, `playerHomeHref`, `seasonHomeHref`,
  `leagueSubpageHref`, `teamSubpageHref`, `playerSubpageHref`,
  `buildTeamSiblingLinks`, `buildPlayerSiblingLinks`,
  `buildSeasonSiblingLinks`, `isActiveHref`.
- `apps/web/src/app/dashboard/_components/history-back-button.tsx` —
  client component using `window.history.back()`; disabled when no
  in-app history entry exists.
- Render history Back in desktop `apps/web/src/app/dashboard/layout.tsx`
  and mobile `apps/web/src/app/dashboard/_components/mobile-header.tsx`.

## Phase 2 — Remove legacy navigation chrome
- Delete `apps/web/src/app/dashboard/_components/breadcrumbs.tsx`,
  `apps/web/src/lib/breadcrumbs.ts`,
  `apps/web/src/lib/__tests__/breadcrumbs.test.ts`,
  `apps/web/src/components/workspace/Breadcrumbs.tsx`,
  `apps/web/src/components/workspace/BackLink.tsx`.
- Remove `<Breadcrumbs />` from `apps/web/src/app/dashboard/layout.tsx`.
- Strip `?from=` plumbing from `apps/web/src/app/dashboard/teams/[id]/page.tsx`
  and `apps/web/src/app/dashboard/players/[id]/page.tsx` (ASR-19).

## Phase 3 — Migrate every Breadcrumbs/BackLink/hand-rolled back row
- League: `page.tsx` (Home), `schedule`, `standings`, `playoffs`, `stats`,
  `manage`, `members`, `requests`.
- Team: `page.tsx`, `roster`, `roster/audit`, `depth-chart`.
- Player: `page.tsx`, `development`.
- Season: `page.tsx`.
- Dev/visual harness: `apps/web/src/app/dev/visual/workspace/page.tsx`.

## Phase 4 — Verify and ship
- `pnpm --filter @sports-management/web type-check`
- `pnpm --filter @sports-management/web lint`
- `pnpm --filter @sports-management/web test:unit` (1,259 tests)
- Playwright (apps/web) on CI: navigation + team-detail specs updated to
  assert against `resource-header-{kind}`.
- Ship via `arc-git-pr-check --ship merge`.

## Out of scope (deferred to #572–#578)
- League Directory / Active Season shortcuts (#572)
- Teams/Divisions view consolidation (#573)
- Player `?from=` canonicalization is in this PR (per ASR-19)
- Season-owned competition routes (#575)
- Settings Home branch (#576)
- Command palette + mobile canonical alignment (#577)
- Full architecture acceptance sweep (#578)
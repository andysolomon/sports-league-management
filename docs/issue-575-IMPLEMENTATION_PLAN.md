# Issue #575 — Move competition views beneath Season Home

## Goal
Make Schedule, Standings, Playoffs, and Stat Leaders canonical children of `/dashboard/seasons/[seasonId]` and convert the legacy League-owned competition URLs (`/dashboard/leagues/[leagueId]/{schedule,standings,playoffs,stats}`) into access-validated permanent redirects.

## ASR contract
- ASR-3: competition views are Season-owned routes.
- ASR-15: legacy `?season=` URLs redirect; without `?season=` resolve Active Season or redirect to Seasons Home.
- ASR-5, ASR-6: preserve authorization, non-disclosing 404s, feature flags.
- ASR-20: Season Home siblings are Overview, Schedule, Standings, Playoffs, Stat Leaders.

## Files to change

### Navigation helpers (already started)
- `apps/web/src/components/workspace/build-league-nav-links.ts`
- `apps/web/src/components/workspace/resource-navigation.ts`

### New Season-owned routes
Create:
- `apps/web/src/app/dashboard/seasons/[id]/schedule/page.tsx`
- `apps/web/src/app/dashboard/seasons/[id]/schedule/actions.ts` (re-export or move)
- `apps/web/src/app/dashboard/seasons/[id]/standings/page.tsx`
- `apps/web/src/app/dashboard/seasons/[id]/playoffs/page.tsx`
- `apps/web/src/app/dashboard/seasons/[id]/playoffs/actions.ts` (re-export or move)
- `apps/web/src/app/dashboard/seasons/[id]/stats/page.tsx`

### Legacy redirects
Replace page content with server redirect in:
- `apps/web/src/app/dashboard/leagues/[id]/schedule/page.tsx`
- `apps/web/src/app/dashboard/leagues/[id]/standings/page.tsx`
- `apps/web/src/app/dashboard/leagues/[id]/playoffs/page.tsx`
- `apps/web/src/app/dashboard/leagues/[id]/stats/page.tsx`

### First-party link emitters
- `apps/web/src/app/dashboard/leagues/[id]/page.tsx`
- `apps/web/src/app/dashboard/seasons/[id]/page.tsx`
- `apps/web/src/app/dashboard/teams/[id]/page.tsx` (division view standings link)
- `apps/web/src/app/dashboard/teams/[id]/games/[gameId]/{live,stats}/page.tsx`
- `apps/web/src/app/dashboard/games/[fixtureId]/{boxscore,gamecast}/page.tsx`
- `apps/web/src/app/dashboard/leagues/[id]/manage/page.tsx`
- `apps/web/src/app/dev/visual/workspace/page.tsx`

### Tests
- Unit: `resource-navigation.test.ts`, `build-league-nav-links` tests, `workspace.test.ts`
- Component/page: season/league schedule, standings, playoffs, stats tests if present
- E2E: `navigation.spec.ts`, `schedule.spec.ts`, `standings.spec.ts`, `playoffs.spec.ts`, `stats.spec.ts`, `team-detail.spec.ts`, `mobile-navigation.spec.ts`

## Approach
1. Finish navigation helper canonicalization (remove remaining `?season=` from first-party emitters).
2. Move/re-export action files to season routes; update component imports.
3. Move page implementations to season routes, deriving `leagueId` from `season.leagueId`.
4. Replace old league pages with server-side permanent redirects (308) using `resolveViewedSeason` / Active Season fallback.
5. Update link emitters across the app to canonical season URLs.
6. Update tests and run type-check, lint, unit, and focused Playwright.

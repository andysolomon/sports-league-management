# Sprint 5 — Salesforce Decoupling Close-Out

> **Sprint:** 2026-04-28 (single-day burst, post-incident)
> **Companion docs:** [SPRINT_5_VERIFICATION.md](./SPRINT_5_VERIFICATION.md) — criteria matrix + locked decisions
> **Stories shipped:** WSM-000040..WSM-000050 (11 stories, 6 PRs after combining + 2 no-op closures)
> **Trigger:** Production incident — Sprint 3 alias promotion surfaced long-broken Salesforce JWT auth (`invalid_client_id`); every dashboard server component 500'd. WSM-000038 + WSM-000039 contained the symptom; Sprint 5 fixed the root cause.

Sprint 5 routes the entire dashboard read tree through Convex (`@/lib/data-api`) instead of Salesforce (`@/lib/salesforce-api`). The work was much smaller than originally scoped because Sprint 2's Phase 1 work had already wired the Convex queries + data-api wrappers — Sprint 5 was mostly import-path swaps.

Per-story implementation notes below.

---

## WSM-000040 — Convex list queries

**PR:** none (no-op closure)

### Resolution
All required Convex queries already existed in `apps/web/convex/sports.ts` (`listLeagues`, `listTeams`, `listPlayers`, `listSeasons`, `listDivisions`) with matching `data-api.ts` wrappers (`getLeagues`, `getTeams`, etc.). Sprint 2 + the seed-harness sprint had laid the foundation. Marked complete with note; sprint pivoted directly to WSM-000041.

---

## WSM-000041 — Convex-native `resolveOrgContext`

**PR:** #144

### Files touched
- `apps/web/src/lib/org-context.ts`
- `apps/web/src/lib/__tests__/org-context.test.ts`

### Key decisions
- Replaced the Salesforce SOQL fan-out (`SELECT Id FROM League__c WHERE Clerk_Org_Id__c IN (...)`) with a single Convex `getVisibleLeagueContext` call from `data-api`. The Convex query already reads both visible leagues (via `leagues.by_orgId`) and subscribed leagues (via `leagueSubscriptions.by_userId`) in one round trip.
- Dropped the WSM-000039 graceful-degradation try/catch — the Convex path can't fail on JWT auth.
- Dropped the unused `idList` SOQL helper.
- Dropped the Clerk `users.getUser` call for `publicMetadata.subscribedLeagueIds` — Convex's `leagueSubscriptions` table is the new source of truth for that list.
- Test rewrite: drop SF query mocks, add `mockGetVisibleLeagueContext` mock. 4 of 8 prior cases collapsed (Convex query handles them at the integration boundary). 255/255 unit tests passing.

---

## WSM-000042 + 043 + 044 — API route swaps

**PR:** #145 (combined)

### Files touched
9 API route handlers under `apps/web/src/app/api/`:
- `/leagues/route.ts` + `/leagues/public/route.ts`
- `/teams/route.ts` + `/teams/[id]/route.ts`
- `/players/route.ts` + `/players/[id]/route.ts`
- `/seasons/route.ts`
- `/divisions/route.ts`
- `/orgs/[orgId]/invite-link/route.ts`

### Key decisions
- Single mechanical sed pass: `s|from "@/lib/salesforce-api"|from "@/lib/data-api"|g`.
- Function signatures match across both modules (Convex equivalents in `data-api.ts` were authored to mirror SF API shapes during Sprint 2).
- Three stories combined into one PR because each was a one-line import change with shared risk profile and shared verification path.

---

## WSM-000045 + 046 — Dashboard pages + entity detail pages

**PR:** #146 (combined)

### Files touched
12 dashboard server components — every page under `apps/web/src/app/dashboard/` that previously imported from `salesforce-api`. Plus 2 test mock fixups (`/api/leagues/public` test, `/api/orgs/[orgId]/invite-link` test).

### Key decisions
- Same mechanical sed pass as WSM-000042 + 043 + 044.
- Side-effect: dropped the WSM-000038 dashboard-root degradation banner. With Convex as the read source there's no JWT auth failure mode to surface, so the try/catch + `degraded` variable + banner are dead code. Restored the dashboard to its pre-degradation shape.
- Test mock fixups: two API route specs were mocking `@/lib/salesforce-api` to control return values. After the swap, the mock target no longer matched. Updated both to mock `@/lib/data-api` directly.

---

## WSM-000047 — Final SF auth-layer cleanup

**PR:** #147

### Files touched
- `apps/web/src/app/dashboard/teams/[id]/depth-chart/page.tsx` (import split)
- `apps/web/src/app/dashboard/teams/[id]/depth-chart/actions.ts` (import split)
- `apps/web/src/lib/authorization.ts` (rewrite — drop SF entirely)
- `apps/web/src/lib/org-context.ts` (drop SF `getLeagueOrgId` + import)
- `apps/web/src/lib/__tests__/authorization.test.ts` (rewrite mocks)
- `apps/web/src/lib/__tests__/org-context.test.ts` (drop describe block + SF mock)

### Key decisions
- `authorization.ts` was using Salesforce directly to query `Team__c.League__c` + then SF `getLeagueOrgId`. Rewrote to use `getTeamLeagueId(teamId)` + `getLeagueOrgId(leagueId)` from data-api. Drops the `getSalesforceConnection` import. AuthorizationResult contract unchanged.
- The SF `getLeagueOrgId` function in `org-context.ts` (15 lines) is now deleted. Module is Salesforce-free.
- Test count: 255 → 252 (3 SF-only assertions removed by design).

---

## WSM-000048 — Schema + index audit

**PR:** none (no-op verification)

### Resolution
Verified all required indexes already exist in `apps/web/convex/schema.ts`: `leagues.by_orgId`, `divisions.by_leagueId`, `teams.by_leagueId`, `players.by_leagueId`, `seasons.by_leagueId`, `leagueSubscriptions.by_userId`. No PR needed.

---

## WSM-000049 — Dashboard tree e2e smoke

**PR:** #148

### Files touched
- `apps/web/e2e/tests/dashboard-tree-convex.spec.ts` (new)

### Key decisions
- Single `describe.serial` block with 2 scenarios:
  1. Dashboard root renders Overview heading + 5 stat card labels; degradation banner absent; no 500 page.
  2. Each list route (`/leagues`, `/teams`, `/players`, `/seasons`, `/divisions`) renders its heading; no 500 page.
- Catches the exact regression that surfaced in production after the Sprint 3 alias promotion. With Sprint 5 in place, this failure mode is gone.
- Reuses the WSM-000022+ infrastructure: `signInTestUser` (one-shot Clerk ticket) + `withRosterFixture` (gives the user non-zero `visibleLeagueIds`).

---

## WSM-000050 — Closeout

**PR:** this PR

### Files touched
- `docs/sprints/SPRINT_5_VERIFICATION.md` (new)
- `docs/sprints/SPRINT_5_CLOSEOUT.md` (this file)

### Key decisions
- **Did not delete `salesforce-api.ts`.** 14 importers under `/api/cli/*` still actively use SF reads + the bulk-import / upsert mutations. Conservative call: keep the module, defer cleanup to Sprint 6.
- Closeout follows the SPRINT_3 doc structure: criteria matrix + locked decisions + per-story notes + deferred work.

---

## Running baseline at sprint close

- `pnpm --filter @sports-management/web type-check` — clean
- `pnpm --filter @sports-management/web lint` — one pre-existing warning, no new
- `pnpm --filter @sports-management/web test:unit` — **252 passed** (down from 255 at Sprint 3 close; 3 SF-only assertions removed in WSM-000047)
- `pnpm exec playwright test --grep "WSM-000049"` — to verify post-merge

## Where Sprint 6 picks up

Two natural paths:

**Sprint 6A — finish the SF eviction:**
1. Convert `/api/cli/*` routes to Convex (10+ routes, mix of reads + mutations + bulk-import).
2. Convert the inline `getLeagueForOrg` helper inside `/api/orgs/[orgId]/invite-link/route.ts` to use `data-api.getLeagueForOrg` (already exists).
3. Drop `salesforce-api.ts` + `salesforce.ts`.
4. Remove `SF_*` env vars from Vercel.

**Sprint 6B — Phase 2 (Player Attributes & Development) per the original Sprint 4 scope:**
The 12-story outline from SPRINT_3_CLOSEOUT.md picks up here: `playerAttributes` table, source adapters (PFF + Madden + admin JSON), development chart UI, public viewer route, etc. Now that the dashboard tree is Convex-native, Phase 2 ships into a coherent stack.

Ordering is your call. 6A is faster (~5 stories, mostly mechanical) but doesn't add user-visible features. 6B is the original product roadmap.

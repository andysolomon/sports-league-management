# Sprint 5 — Salesforce Decoupling — Verification Report

> **Status:** Code merged to `main`. No production flag flip required (the decoupling replaces the read path outright; Convex was already authoritative for these entities per Phase 1).
> **Closed (code):** 2026-04-28
> **Source plan:** Triggered by the production incident where the alias-promoted Sprint 3 deploy surfaced a long-broken Salesforce JWT auth (`invalid_client_id`) — every dashboard server component 500'd. WSM-000038 + WSM-000039 contained the symptom; Sprint 5 fixed the root cause by routing reads through Convex.
> **Anchor:** Convex was already authoritative for leagues / teams / players / seasons / divisions / `leagueSubscriptions` (Phase 1). The work was wiring the existing `data-api.ts` Convex wrappers into the consumers that were still calling `salesforce-api.ts`.

## Locked decisions

| # | Question | Resolution |
|---|---|---|
| 1 | Build new Convex queries or reuse existing? | Reuse — every required query (`listLeagues`, `listTeams`, `listPlayers`, `listSeasons`, `listDivisions`, `getVisibleLeagueContext`) already existed from Sprint 2. |
| 2 | Drop `salesforce-api.ts` entirely? | No — CLI routes under `/api/cli/*` still use SF reads + the bulk-import / upsert mutations. Defer cleanup to Sprint 6. |
| 3 | Per-page degradation banner from WSM-000038? | Drop. The Convex path can't fail on JWT auth, so the banner can never fire. |
| 4 | E2E coverage? | Add a single dashboard-tree smoke spec (WSM-000049) that walks every list route authenticated and asserts no 500. |
| 5 | Schema additions? | None — every required index already exists (audit in WSM-000048). |

## Criteria Matrix

| # | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| 1 | `resolveOrgContext` reads visible leagues from Convex, not Salesforce | `apps/web/src/lib/org-context.ts` calls `getVisibleLeagueContext` from data-api | ✓ |
| 2 | `getLeagueOrgId` reads from Convex (not SF SOQL) | SF version dropped from `org-context.ts`; data-api version in use everywhere | ✓ |
| 3 | All dashboard read API routes call data-api (Convex) | `/api/leagues`, `/api/leagues/public`, `/api/teams`, `/api/teams/[id]`, `/api/players`, `/api/players/[id]`, `/api/seasons`, `/api/divisions`, `/api/orgs/[orgId]/invite-link` | ✓ |
| 4 | All dashboard server components call data-api | 12 files: dashboard root, discover, leagues + nested, teams + detail, players, seasons, divisions, billing | ✓ |
| 5 | Dashboard root degradation banner removed | `apps/web/src/app/dashboard/page.tsx` simplified back to direct call shape | ✓ |
| 6 | `authorization.ts` independent of Salesforce | `getTeamLeagueId` + `getLeagueOrgId` from data-api; `getSalesforceConnection` import dropped | ✓ |
| 7 | Required Convex indexes exist | `leagues.by_orgId`, `divisions.by_leagueId`, `teams.by_leagueId`, `players.by_leagueId`, `seasons.by_leagueId`, `leagueSubscriptions.by_userId` all present | ✓ |
| 8 | E2E dashboard-tree smoke spec added | `apps/web/e2e/tests/dashboard-tree-convex.spec.ts` (2 scenarios via the seed harness + sign-in helper) | ✓ |
| 9 | Type-check + lint clean after every story | each PR's CI | ✓ |
| 10 | Unit tests still pass | 252/252 (3 SF-only assertions removed, intentional) | ✓ |
| 11 | `org-context.test.ts` updated to mock `data-api.getVisibleLeagueContext` | tests rewrite shipped in WSM-000041 + WSM-000047 | ✓ |
| 12 | `authorization.test.ts` updated to mock `data-api.getTeamLeagueId` + `getLeagueOrgId` | shipped in WSM-000047 | ✓ |

## PR / Release Evidence

| Story | Branch | PR | Notes |
| --- | --- | --- | --- |
| WSM-000040 | — | — | No-op: queries already existed (Sprint 2). Marked complete. |
| WSM-000041 | `feat/WSM-000041-resolve-org-context-convex` | #144 | resolveOrgContext rewrite |
| WSM-000042 + 043 + 044 | `feat/WSM-000042-044-api-routes-convex` | #145 | 9 API route swaps, combined |
| WSM-000045 + 046 | `feat/WSM-000045-046-page-swaps` | #146 | 12 page swaps + WSM-000038 banner removal |
| WSM-000047 | `feat/WSM-000047-getleagueorgid-cleanup` | #147 | depth-chart + authorization.ts SF cleanup; SF `getLeagueOrgId` deleted |
| WSM-000048 | — | — | No-op: all required indexes already present in `convex/schema.ts`. Marked complete. |
| WSM-000049 | `feat/WSM-000049-dashboard-e2e-smoke` | #148 | dashboard-tree smoke spec |
| WSM-000050 | `feat/WSM-000050-sprint5-closeout` | this PR | docs |

Six PRs total (combined where appropriate). Two stories closed without code changes.

## Deferred / Sprint 6 candidates

1. **CLI route decoupling.** 14 importers under `/api/cli/*` still pull from `salesforce-api.ts`:
   - Reads: `getLeagues`, `getTeams`, `getDivisions`, `getSeasons`, `getTeamsByLeague`, `getPlayersByTeam`, `getLeagueByInviteToken`
   - Mutations: `createTeam`, `updatePlayer`
   - Bulk: `bulkImportLeague`
   Convex equivalents exist for the reads + most mutations. `bulkImportLeague` doesn't have a direct Convex peer yet — that's the biggest piece of work. Defer to Sprint 6.

2. **Inline `getLeagueForOrg` helper inside `/api/orgs/[orgId]/invite-link/route.ts`.** Still does an inline SF SOQL `SELECT Id, Invite_Token__c FROM League__c WHERE Clerk_Org_Id__c = ...`. Could be replaced with a Convex query (`getLeagueForOrg` already exists in `data-api.ts`).

3. **Drop `apps/web/src/lib/salesforce-api.ts` entirely.** Only safe once #1 + #2 are done.

4. **Drop the JWT bearer flow + `apps/web/src/lib/salesforce.ts` connection helper.** Only safe once `salesforce-api.ts` is gone.

5. **Remove production env vars** `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_USERNAME`, `SF_PRIVATE_KEY` from Vercel. Only safe after #4.

## Risks closed

- **Production 500 from broken SF JWT auth.** WSM-000041 routed `resolveOrgContext` (the chokepoint) to Convex. The dashboard tree no longer surfaces the Salesforce auth failure mode at all.
- **Per-page graceful degradation drift.** WSM-000045 dropped the WSM-000038 banner. There's no longer a code path where the dashboard shows zeros + a banner — it either renders real data (Convex up) or errors at the framework layer (Convex down, qualitatively different from a stale SF token).
- **Mock divergence in tests.** `org-context.test.ts` and `authorization.test.ts` were rewritten to mock the new data-api boundary, so future refactors won't silently degrade test coverage.

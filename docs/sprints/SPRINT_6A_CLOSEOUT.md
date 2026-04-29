# Sprint 6A — Salesforce Eviction Close-Out

> **Sprint:** 2026-04-29 (single-day burst, post-Sprint-5)
> **Companion docs:** [SPRINT_6A_VERIFICATION.md](./SPRINT_6A_VERIFICATION.md) — criteria matrix + locked decisions
> **Stories shipped:** WSM-000051..WSM-000053 + WSM-000052b (4 PRs)
> **Outcome:** Salesforce is fully removed from the codebase. Closes the strategic direction set in the Sprint 3 grilling.

Per-story implementation notes below.

---

## WSM-000051 — Final SF importer eviction

**PR:** #150

### Files touched (18)
- `/app/join/[token]/page.tsx` — single import swap.
- `/app/api/cli/{leagues, teams, players, players/[id], divisions, seasons, import}` (7 routes) + their `__tests__/`.
- `/lib/sync/nfl-sync.ts` + its test (preliminary swap, fully ported in WSM-000052b).
- `/api/orgs/[orgId]/invite-link/route.ts` — inline `getLeagueForOrg` SOQL helper rewritten to use `data-api.getLeagueForOrg`.

### Key decisions
- Most files were one-line `vi.mock("@/lib/salesforce-api"` → `vi.mock("@/lib/data-api"` swaps. Done with a `perl -i -pe` pass.
- The invite-link helper was the trickiest — the existing Convex `getLeagueForOrg` query already returned `{id, token}` matching the inline helper's contract exactly. Pure drop-in adapter.

---

## WSM-000052 — Drop salesforce-api.ts + Convex-ify health/subscribe

**PR:** #151

### Files deleted (3)
- `apps/web/src/lib/salesforce-api.ts`
- `apps/web/src/lib/salesforce-bulk-import.ts` (re-export shim)
- `apps/web/src/lib/__tests__/salesforce-api-scoped.test.ts` (self-test for the deleted module)

### Files rewritten (2)
- `/api/health/route.ts` — was probing the SF connection + enumerating SF env vars. Now does a Convex round-trip via `getPublicLeagues()` + a `NEXT_PUBLIC_CONVEX_URL` presence check. Cheaper, more meaningful (proves Convex reachable + sports module loads).
- `/api/leagues/subscribe/route.ts` — was using SOQL to verify `isPublic` + writing subscriptions to Clerk `publicMetadata`. Now uses `subscribeToLeague` + `unsubscribeFromLeague` from data-api, writing to the Convex `leagueSubscriptions` table — the actual source of truth that `resolveOrgContext` reads (per WSM-000041). The Clerk-metadata write was already dead code post-Sprint-5; this completes the migration.

### Test mock fixup
- subscribe route (4 cases rewritten): mock the data-api mutations directly; drop the SF query mock + Clerk getUser/updateUser mocks.

### Key decisions
- Test count dropped 252 → 231 (intentional: -21 from the deleted self-test file).
- `salesforce.ts` preserved this PR — `nfl-sync.ts` still imported it. Handled in WSM-000052b.

---

## WSM-000052b — Port nfl-sync to Convex syncConfigs

**PR:** #152

### Files touched (2)
- `apps/web/src/lib/sync/nfl-sync.ts` — three SF-coupled functions replaced with delegations to data-api's already-Convex-backed equivalents.
- `apps/web/src/lib/sync/__tests__/nfl-sync.test.ts` — rewritten to mock the data-api boundary instead of the SF connection.

### Key decisions
- `readSyncConfig`, `updateSyncEnabled`, and `writeSyncReport` already existed Convex-backed in `data-api.ts` (via the existing `syncConfigs` table). nfl-sync just needed to re-export the first two and use `writeSyncReport` inline.
- After this PR, `salesforce.ts` had zero remaining importers in the codebase.
- Test count: 231 → 229 (2 SF-only assertions removed during the rewrite).

---

## WSM-000053 — Final delete + closeout

**PR:** this PR

### Files deleted (1)
- `apps/web/src/lib/salesforce.ts` (the JWT bearer flow + connection helper).

### Other changes
- Removed the SF JWT block from `apps/web/.env.local.example` (SF_LOGIN_URL, SF_CLIENT_ID, SF_USERNAME, SF_PRIVATE_KEY).
- Removed `jsforce` from `apps/web/package.json` dependencies via `pnpm remove jsforce`.
- New `docs/sprints/SPRINT_6A_VERIFICATION.md` + `docs/sprints/SPRINT_6A_CLOSEOUT.md` (this file).

### Key decisions
- Combined the final delete and the closeout docs into one PR since the file deletion was trivial (1 file gone, ~50 lines) and the docs needed the deletion's PR number to be accurate.

---

## Running baseline at sprint close

- `pnpm --filter @sports-management/web type-check` — clean
- `pnpm --filter @sports-management/web lint` — one pre-existing warning, no new
- `pnpm --filter @sports-management/web test:unit` — **229 passed** (down from 252 at Sprint 5 close — all reductions are SF-only assertions intentionally removed during the conversion)
- `grep -rE "from \"@/lib/salesforce" apps/web/src/` — **zero matches** (verified)
- `grep -rE "jsforce" apps/web/src/` — **zero matches** (verified)

## Where Sprint 6B picks up

Phase 2 — Player Attributes & Development — per the original SPRINT_3_CLOSEOUT.md outline (12 stories starting at WSM-000054). Now ships into a clean Convex-native stack.

```
WSM-000054  Schema: playerAttributes table + indexes
WSM-000055  Flag: player_attributes_v1
WSM-000056  Source adapters: PFF + Madden + admin-JSON normalizers
WSM-000057  Ingest mutation: ingestPlayerAttributes
WSM-000058  Query API: getPlayerDevelopment + getSeasonAttributesByPosition
WSM-000059  Public-read primitives: leagues.isPublic + publicLeagueGuard
WSM-000060  UI: /dashboard/players/[id]/development
WSM-000061  UI: /leagues/[slug]/players/[id]/development (public)
WSM-000062  UI: /dashboard/seasons/[id]/attributes/[positionGroup]
WSM-000063  UI: admin upload + Make-public toggle
WSM-000064  E2E coverage
WSM-000065  Analytics + docs + Sprint 6B closeout
```

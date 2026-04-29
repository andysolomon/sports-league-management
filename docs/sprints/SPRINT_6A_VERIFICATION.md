# Sprint 6A — Salesforce Eviction — Verification Report

> **Status:** Code merged to `main`. **Salesforce is fully removed from the codebase.**
> **Closed (code):** 2026-04-29
> **Source plan:** SPRINT_5_CLOSEOUT.md "Sprint 6A — finish SF eviction" follow-up. Completes the strategic direction set in the Sprint 3 grilling: *"forget about backwards compatibility with Salesforce. We are going full throttle with convex."*
> **Anchor:** Convex was already authoritative for every entity Sprint 5 touched. Sprint 6A picked up the long tail — CLI routes, the inline `getLeagueForOrg` SOQL helper, the NFL-sync config bookkeeping, and the eventual deletion of the SF modules + env vars + jsforce dependency.

## Locked decisions

| # | Question | Resolution |
|---|---|---|
| 1 | Port the CLI bulk-import or drop it? | Port. `bulkImportLeague` already existed Convex-backed in `data-api.ts`; CLI route was a one-line import swap. |
| 2 | Inline `getLeagueForOrg` SOQL helper inside invite-link route? | Replace with `data-api.getLeagueForOrg` (existing Convex query already returns `{id, token}` matching the helper's contract). |
| 3 | NFL-sync config table: build new or reuse `syncConfigs`? | Reuse. The Convex `syncConfigs` table + `getSyncConfig` / `setSyncEnabled` / `writeSyncReport` already existed; nfl-sync just needed to delegate. |
| 4 | Health route: SF probe or Convex probe? | Convex. `getPublicLeagues()` round-trip + `NEXT_PUBLIC_CONVEX_URL` presence check. Cheaper, more meaningful. |
| 5 | Subscribe route: SF SOQL or Convex `leagueSubscriptions`? | Convex. Aligns the write path with the read path (`resolveOrgContext` reads from `leagueSubscriptions` per Sprint 5). |
| 6 | Delete `salesforce.ts` + jsforce dep + SF env vars? | Yes — once nfl-sync was the last importer and got ported in WSM-000052b. |

## Criteria Matrix

| # | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| 1 | All CLI routes consume data-api (Convex) | 7 route files swapped in WSM-000051 | ✓ |
| 2 | `/api/orgs/[orgId]/invite-link` uses Convex `getLeagueForOrg` | inline helper rewritten; SF import dropped | ✓ |
| 3 | `/join/[token]/page.tsx` consumes data-api | one-line swap | ✓ |
| 4 | `/api/health` uses Convex probe | `getPublicLeagues()` round-trip | ✓ |
| 5 | `/api/leagues/subscribe` uses Convex `leagueSubscriptions` | `subscribeToLeague` / `unsubscribeFromLeague` from data-api | ✓ |
| 6 | `nfl-sync.ts` Salesforce-free | uses data-api's `readSyncConfig` / `updateSyncEnabled` / `writeSyncReport` (Convex `syncConfigs` table) | ✓ |
| 7 | `apps/web/src/lib/salesforce-api.ts` deleted | removed in WSM-000052 | ✓ |
| 8 | `apps/web/src/lib/salesforce-bulk-import.ts` deleted | removed in WSM-000052 | ✓ |
| 9 | `apps/web/src/lib/salesforce.ts` deleted | removed in WSM-000053 | ✓ |
| 10 | `apps/web/src/lib/__tests__/salesforce-api-scoped.test.ts` deleted | removed in WSM-000052 | ✓ |
| 11 | SF env vars removed from `.env.local.example` | removed in WSM-000053 | ✓ |
| 12 | `jsforce` removed from `apps/web/package.json` | removed in WSM-000053 | ✓ |
| 13 | Type-check + lint clean after every story | each PR's CI | ✓ |
| 14 | Unit tests still pass | 229/229 (down from 231 — 2 SF-only assertions removed during the conversion) | ✓ |

## PR / Release Evidence

| Story | Branch | PR | Notes |
| --- | --- | --- | --- |
| WSM-000051 | `feat/WSM-000051-final-sf-eviction` | #150 | 16 importers swapped + invite-link inline helper rewritten + 8 test mock updates |
| WSM-000052 | `feat/WSM-000052-drop-salesforce-modules` | #151 | salesforce-api.ts + salesforce-bulk-import.ts + the self-test deleted; health + subscribe routes Convex-ified |
| WSM-000052b | `feat/WSM-000052b-nfl-sync-convex` | #152 | nfl-sync.ts ported to Convex `syncConfigs` |
| WSM-000053 | `feat/WSM-000053-final-sf-delete-and-closeout` | this PR | salesforce.ts deleted + SF env vars removed + jsforce dep removed + closeout docs |

Four PRs total. The original Sprint 6A scope (3 stories) expanded to 4 once the audit revealed `/api/health` + `/api/leagues/subscribe` + `nfl-sync.ts` as additional SF surfaces. Honest scope expansion, not scope creep.

## Risks closed

- **Salesforce auth failure mode** — no longer exists in any user-facing route. The dashboard tree was already Convex post-Sprint-5; Sprint 6A removed the last few SF couplings (CLI, invite-link, health, subscribe, NFL sync).
- **Stale Clerk publicMetadata writes** — `/api/leagues/subscribe` was writing to a metadata path that `resolveOrgContext` no longer reads. WSM-000052 redirected the writes to the canonical `leagueSubscriptions` Convex table.
- **Dead code paths** — every Salesforce module is gone; no risk of someone re-importing a stale SF helper.
- **`jsforce` dep size** — removed. Ships smaller bundles + faster `pnpm install`.

## What's next

**Sprint 6B — Phase 2 (Player Attributes & Development)** per the original SPRINT_3_CLOSEOUT outline. 12 stories:

```
WSM-000054  Schema: playerAttributes table + indexes
WSM-000055  Flag: player_attributes_v1
WSM-000056  Source adapters: PFF + Madden + admin-JSON normalizers
WSM-000057  Ingest mutation: ingestPlayerAttributes
WSM-000058  Query API: getPlayerDevelopment + getSeasonAttributesByPosition
WSM-000059  Public-read primitives: leagues.isPublic + publicLeagueGuard
WSM-000060  UI: /dashboard/players/[id]/development (org-gated, 8-bit)
WSM-000061  UI: /leagues/[slug]/players/[id]/development (public, 8-bit)
WSM-000062  UI: /dashboard/seasons/[id]/attributes/[positionGroup]
WSM-000063  UI: admin upload + Make-public toggle
WSM-000064  E2E coverage
WSM-000065  Analytics + docs + Sprint 6B closeout
```

Now ships into a clean Convex-native stack with no SF interactions to think about.

**Optional cleanup follow-ups (any future sprint):**
- Remove `SF_*` env vars from Vercel project settings.
- Audit Salesforce orgs / connected apps for unused JWT credentials.
- Update `apps/web/README.md` to drop Salesforce setup notes.

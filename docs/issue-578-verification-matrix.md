# Wayfinder Verification Matrix — issue #578

Captured at HEAD `1bf0616` on `main` (post merge of #589 chore archive).

Source-of-truth: `docs/design/navigation-asr.md`, `CONTEXT.md`, and shipped PRs under the Wayfinder epic (#570–#576). This file is the evidence body for #578; parent runs all automated checks before closing the story.

## 0. Heads-up checks at HEAD

| Check | Command | Result | Source |
| --- | --- | --- | --- |
| Type-check | `pnpm --filter @sports-management/web exec tsc --noEmit` | exit 0, 0 diagnostics | local run, /tmp/tc-578.log |
| Vitest (apps/web) | `pnpm --filter @sports-management/web exec vitest run` | 182 files / 1270 tests passed | local run, /tmp/vitest-578.log |
| E2E workflow on main | `gh run list --workflow=E2E --branch=main --limit=1` (id 28414432534) | Playwright (apps/web) success; Visual regression (non-blocking) failure | GH Actions, head 40f309bd |
| CI workflow on main | `gh run list --workflow=CI --branch=main --limit=1` (id 29781865053) | Lint/Type-check/Test/Build success; Commitlint skipped (docs-only chore) | GH Actions, head 1bf0616 |

Visual regression is non-blocking and known to render diffs on the docs/UI surfaces once a navigation lands; it is not a navigation-correctness signal and is excluded from Pass/Fail decisions.

## 1. ASR acceptance-criteria evidence

Status legend: `Pass` = covered with passing local or CI-run evidence; `Partial` = covered by unit/component assertions only (CI e2e absent); `Follow-up` = gap owned by a follow-up issue under epic #569.

| ASR | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| ASR-1 | Active League context state lives in the cookie/Active League Library | `apps/web/src/lib/__tests__/active-league.test.ts`, `active-league-server.test.ts`; `app/dashboard/active-league/__tests__/route.test.ts` | Pass |
| ASR-2 | Resource Header is reusable and replaces breadcrumbs | `apps/web/src/components/workspace/__tests__/resource-header.test.ts`; `workspace.test.ts`; e2e `navigation.spec.ts:91,111` | Pass |
| ASR-3 | Canonical redirect/404 rules for legacy IDs | `apps/web/src/app/dashboard/divisions/__tests__/legacy-redirect.test.ts:47,54,70`; `app/dashboard/__tests__/active-league-resource-pages.test.ts` | Pass |
| ASR-4 | Sidebar shows Overview/Teams/Players/Seasons/Settings | `apps/web/src/app/dashboard/_components/__tests__/active-league-navigation.test.ts:33,53` (post-#577 nav items) | Pass |
| ASR-5 | Active League Home is the default landing page when a league is active | `apps/web/src/app/dashboard/__tests__/active-league-resource-pages.test.ts:74,85,105`; e2e `navigation.spec.ts` | Pass |
| ASR-6 | Canonical Season-owned competition routes redirect/own `/seasons/[id]/...` | `apps/web/src/components/workspace/__tests__/workspace.test.ts:82`; `divisions/__tests__/legacy-redirect.test.ts`; e2e `navigation.spec.ts:129` | Pass |
| ASR-7 | Each resource exposes a Home (`leagueHomeHref`, `teamHomeHref`, `seasonHomeHref`, `playerHomeHref`) | `apps/web/src/components/workspace/__tests__/resource-navigation.test.ts`; e2e `team-detail.spec.ts:126` | Pass |
| ASR-8 | Settings Home → League Settings (Org Admin) and Account Settings; Account owns Import + Billing | `apps/web/e2e/tests/settings-home.spec.ts:20,37,44` (#588); `apps/web/src/components/workspace/__tests__/resource-navigation.test.ts:50` | Pass |
| ASR-9 | Active Season shortcut from League Home lands on the latest season | `apps/web/src/components/workspace/__tests__/resource-navigation.test.ts:72`; `LeagueCurrentSeasonCard.test.ts:26` (unit); e2e `league-info.spec.ts:35` deliberately does not assert the shortcut | Partial -> Follow-up |
| ASR-10 | Active League sync on cross-resource traversal | `apps/web/src/app/dashboard/_actions/__tests__/active-league-sync-action.test.ts`; `apps/web/src/lib/__tests__/active-league.test.ts` | Pass |
| ASR-11 | Org Admin gate on League Settings; non-admin 404 | `apps/web/src/lib/__tests__/permissions.test.ts`; `apps/web/e2e/tests/settings-home.spec.ts:27`; `league-info.spec.ts` non-admin branch | Pass |
| ASR-12 | Cross-league switches preserve Back/history | `apps/web/src/app/dashboard/_components/__tests__/active-league-navigation.test.ts:21` (URL builders); e2e `navigation.spec.ts:85` describes "League workspace back navigation" but only covers Resource Header identification + legacy redirects (WSM-000236) — no Back boundary assertion | Partial -> Follow-up |
| ASR-13 | Mobile sheet parity + drawer close on navigation | `apps/web/e2e/tests/mobile-navigation.spec.ts:68,103` (#585) | Pass |
| ASR-14 | League Directory shortcut re-shown when no Active League | `apps/web/src/components/workspace/__tests__/teams-home-navigation.test.ts` (unit); no e2e that proves Directory appears under no-league state | Partial -> Follow-up |
| ASR-15 | Divisions consolidated under Teams | `apps/web/e2e/tests/teams-redesign.spec.ts:40,54` (#573) | Pass |
| ASR-16 | View-change "Back" lands on the prior canonical Home (not legacy) | No focused e2e | Follow-up |
| ASR-17 | Active League consistency is identity-bound, not URL-bound | `apps/web/src/lib/__tests__/active-league.test.ts`; `apps/web/src/app/dashboard/__tests__/active-league-resource-pages.test.ts` | Pass |
| ASR-18 | Player Home canonical name + child navigation | `apps/web/src/components/workspace/__tests__/resource-navigation.test.ts` (`playerHomeHref`); e2e `team-detail.spec.ts` player routes (#587) | Pass |
| ASR-19 | `?from=` cleanup completed | `apps/web/src/app/dashboard/_components/__tests__/active-league-navigation.test.ts` no longer expects `?from=team-*` after #587 | Pass |
| ASR-20 | League Home Manage → League Settings | `apps/web/e2e/tests/league-info.spec.ts:32` (post #588); `apps/web/src/components/workspace/__tests__/resource-navigation.test.ts` (`leagueSettingsHref`) | Pass |
| ASR-21 | Resource Header surfaces league name + Action chip | `apps/web/src/components/workspace/__tests__/resource-header.test.ts`; e2e `navigation.spec.ts:91` | Pass |
| ASR-22 | Settings available without an Active League | `apps/web/e2e/tests/settings-home.spec.ts:44` (Account only when no league); unit: `shell-nav.ts` keeps Settings off `hideWithoutLeague` | Pass |
| ASR-23 | Command palette contains the same canonical destinations | `apps/web/src/app/dashboard/_components/__tests__/command-palette-nav.test.ts:6,32,55,62` (post #585/#588) | Pass |
| ASR-24 | Active League sync survives reload | `apps/web/src/lib/__tests__/active-league-server.test.ts` | Pass |
| ASR-25 | End-to-end navigation Playwright flows cover canonical transitions | E2E workflow Playwright (apps/web) success (head 40f309bd on latest main); per-spec evidence in ASR-4/13/15/18/20/22 rows; ASR-9/12/14/16 lack focused e2e (Follow-up rows below) | Pass-with-follow-ups |

## 2. Redirect / 404 / Active League sync rules (CONTEXT.md)

| Rule | Evidence | Status |
| --- | --- | --- |
| Legacy `?season=` -> canonical Season URL | e2e `navigation.spec.ts:129` | Pass |
| `manage` access-validated redirect to League Settings (#588) | `apps/web/src/app/dashboard/leagues/[id]/manage/page.tsx` (access-check + permanentRedirect); `apps/web/e2e/tests/league-info.spec.ts:78` non-admin notFound | Pass |
| `/dashboard/import`, `/dashboard/billing` -> `/dashboard/settings/account/import\|billing` | `apps/web/src/app/dashboard/import/page.tsx`, `import/format/page.tsx`, `billing/page.tsx` (redirects); `apps/web/e2e/tests/mobile-import.spec.ts` post-#588 | Pass |
| Non-disclosing 404 for unauthorized league | `apps/web/src/lib/__tests__/authorization.test.ts`; `apps/web/e2e/tests/api-auth.spec.ts` | Pass |
| Active League sync reuses on resource nav | `apps/web/src/app/dashboard/_actions/__tests__/active-league-sync-action.test.ts` | Pass |

## 3. Open gaps mapped to epic #569 follow-ups

| ASR | Gap | Proposed follow-up |
| --- | --- | --- |
| ASR-9 | No Playwright assertion that "Open Active Season" shortcut from League Home lands on the latest season URL | Issue: "e2e Active Season shortcut from League Home" under epic #569 |
| ASR-12 | No Playwright assertion for Back/history boundary on cross-league switch | Issue: "e2e cross-league Back/history boundary" under epic #569 |
| ASR-14 | No Playwright assertion that League Directory shortcut re-shows under no-league state | Issue: "e2e no-league Directory shortcut visibility" under epic #569 |
| ASR-16 | No focused e2e for view-change Back landing on prior canonical Home | Issue: "e2e view-change Back semantics" under epic #569 |

## 4. Closure summary

- All 25 ASRs either `Pass` or carry a follow-up under epic #569.
- Local type-check and vitest green at HEAD `1bf0616`.
- E2E workflow Playwright app/web success on latest main; CI Lint/Type/Test/Build success on #589.
- Visual regression remains non-blocking (recurring diff on UI sub-100KB surfaces) — not a navigation signal.

Once the parent files the four follow-up issues under #569 and this matrix lands on `main` via a docs-only PR, #578 closes; epic #569 closes when its children are all closed or all delegated.

# Issue 576 — Split Settings into League and Account homes

## 1. Product goal and scope boundaries

Introduce **Settings Home** as the shell Settings destination (ASR-4), branching into role-gated **League Settings** and always-available **Account Settings** (ASR-8, ASR-11). Move Import and Billing under Account Settings; redirect legacy URLs; update League Home’s Manage affordance to League Settings. Preserve cross-league Import semantics (payload owns league identity).

**In scope**
- `/dashboard/settings` (Settings Home)
- `/dashboard/settings/league` (League Settings for Active League; Org Admin only)
- `/dashboard/settings/account` (+ Import / Billing destinations under Account)
- Permanent redirects from `/dashboard/import`, `/dashboard/billing`, and `/dashboard/leagues/[id]/manage`
- Shell + command palette: replace Import/Billing with Settings
- League Home Manage → League Settings
- Unit + focused Playwright updates

**Out of scope / deferred**
- Full navigation acceptance matrix (#578)
- Redesign of Import/Billing/manage UI beyond route/ownership moves
- Nesting `/dashboard/roles` under Settings (not required by ASR-8; left at current path unless a follow-up asks)

## 2. Current baseline

- Shell (`shell-nav.ts`) still lists Import + Billing at `/dashboard/import` and `/dashboard/billing` (explicitly deferred from #577).
- League admin surface lives at `/dashboard/leagues/[id]/manage` with `requireOrgAdmin` + `data-testid="league-manage-settings"`; League Home links **Manage** there.
- Billing is user-scoped (Stripe tier/customer); Import form/NFL sync already carry league selection in payload (cross-league import must stay intact).
- No `/dashboard/settings/**` tree exists yet.
- e2e: `league-info.spec.ts` (manage), `mobile-import.spec.ts` (`/dashboard/import`), `schedules-standings` / `player-attributes` hit manage URLs.

## 3. Missing capabilities

| Gap | ASR / CONTEXT | Fix |
| --- | --- | --- |
| No Settings Home / League / Account routes | ASR-8 | Add settings tree |
| Import & Billing are top-level shell items | ASR-4, ASR-8 | Shell → Settings only; nest under Account |
| Manage URL is League-scoped path, not Settings | ASR-8, ASR-11 | Canonical `/dashboard/settings/league` + redirect from manage |
| League Settings discoverability for non-admins | ASR-11 | Settings Home shows League Settings only when Org Admin; direct access 404 |
| Palette/sidebar still advertise Import/Billing | ASR-23 / #577 follow-through | Update `buildShellNavItems` / palette icons |

## 4. Milestones / phases

### Phase 1 — Settings route tree + redirects

**Goals:** Canonical Settings URLs exist; legacy URLs permanently redirect after access checks.

**Deliverables**
- `apps/web/src/app/dashboard/settings/page.tsx` — Settings Home: cards/links to Account Settings (always) and League Settings (Org Admin of Active League only; otherwise omit or show disabled copy without leaking other orgs). No Active League → omit League Settings or link to Directory (ASR-22).
- `apps/web/src/app/dashboard/settings/account/page.tsx` — Account Settings hub with links/sections for Import and Billing (CONTEXT language).
- `apps/web/src/app/dashboard/settings/account/import/page.tsx` — move or re-export current Import UI from `dashboard/import/`.
- `apps/web/src/app/dashboard/settings/account/billing/page.tsx` — move or re-export current Billing UI; preserve Stripe success/cancel query params via redirect.
- `apps/web/src/app/dashboard/settings/league/page.tsx` — League Settings for **Active League**: reuse manage page content (extract shared component or call into existing modules). `requireOrgAdmin` / `canManageOrgSettings`; unauthorized → `notFound()` (ASR-11). Sync Active League if needed.
- Redirects:
  - `/dashboard/import` → `/dashboard/settings/account/import` (permanent)
  - `/dashboard/billing` → `/dashboard/settings/account/billing` (preserve `?success` / `?cancelled`)
  - `/dashboard/leagues/[id]/manage` → after access validation, sync Active League to `id` when authorized, then permanent redirect to `/dashboard/settings/league`; invalid/inaccessible → non-disclosing 404 (same as today)

**Acceptance criteria**
- [ ] Settings Home reachable at `/dashboard/settings`
- [ ] Account Settings exposes Import + Billing
- [ ] League Settings only for Org Admins; others get non-disclosing 404 on direct URL
- [ ] Legacy import/billing/manage URLs redirect or 404 correctly
- [ ] Import still supports selecting a target league in the payload (cross-league)

### Phase 2 — Shell, League Home, and first-party links

**Goals:** Navigation matches ASR-4; Manage points at League Settings.

**Deliverables**
- `shell-nav.ts`: remove `import` / `billing`; add `settings` → `/dashboard/settings` (available with or without leagues — ASR-22 Account Settings remains).
- Update `command-palette.tsx` icon map for `settings`.
- League Home Manage link → `/dashboard/settings/league` (and ensure Active League is that league before navigate, or use activation href if crossing leagues).
- Update any other first-party “Manage league” / Import / Billing emitters under `apps/web/src` (grep).
- `active-league-navigation` / `command-palette-nav` / mobile-navigation e2e: expect Settings, not Import/Billing.

**Acceptance criteria**
- [ ] Desktop + mobile shell + palette show Settings; no Import/Billing top-level
- [ ] Admin Manage from League Home lands on League Settings

### Phase 3 — Tests + type-check

**Goals:** Lock contracts; keep suites green.

**Deliverables**
- Unit: settings nav helpers / redirect targets; shell destinations; Org Admin gate for League Settings (if extractable).
- Playwright: update `league-info.spec.ts`, `mobile-import.spec.ts`, mobile-navigation shell labels; add Settings Home smoke (Account + conditional League Settings).
- `pnpm --filter @sports-management/web type-check`
- Focused Playwright green

**Acceptance criteria**
- [ ] Type-check + unit + focused e2e green

## 5. Out-of-scope / deferred

- #578 epic-wide verification
- Visual redesign of manage/import/billing content
- Moving Roles matrix into Settings

## 6. Immediate next steps

1. Branch `feat/issue-576-settings-homes` from updated `main`.
2. Implement Phases 1–3; PR with `Closes #576`.

## Implementation Plan (task checklist)

**Story:** #576 Split Settings into League and Account homes  
**Branch:** `feat/issue-576-settings-homes`

### Analysis

Import/Billing are shell leftovers from before Settings ownership was defined. League admin UI already exists at `manage` with the right auth gate; #576 renames/relocates that surface under Settings and removes Import/Billing from the rail.

### Tasks

- [ ] **1. Extract or relocate Import + Billing under Account Settings routes**
  - Files: `apps/web/src/app/dashboard/settings/account/**`, legacy `import/` + `billing/` become redirects
- [ ] **2. League Settings page from Active League manage content**
  - Files: `settings/league/page.tsx`, refactor `leagues/[id]/manage` → redirect wrapper
- [ ] **3. Settings Home hub**
  - Files: `settings/page.tsx`
- [ ] **4. Shell + palette + League Home Manage link**
  - Files: `shell-nav.ts`, `command-palette.tsx`, `leagues/[id]/page.tsx`, tests
- [ ] **5. Update e2e + type-check**
  - Files: `league-info.spec.ts`, `mobile-import.spec.ts`, `mobile-navigation.spec.ts`, new settings smoke if needed

### Test Strategy

- Unit: shell destinations; League Settings auth; redirect path helpers
- E2E: Settings Home; Account Import via redirect; admin Manage → League Settings; non-admin manage/settings/league → 404
- Manual: Import into a non-Active League still works; Billing Stripe return URLs

### Acceptance Criteria Mapping

| Criterion | Task(s) | How Verified |
| --- | --- | --- |
| Settings Home branches to League + Account | 3 | Unit + e2e |
| Account owns Import + Billing | 1 | Routes + e2e |
| League Settings Org-Admin only; 404 otherwise | 2 | e2e league-info + unit |
| Redirect import/billing/manage | 1, 2 | e2e |
| Cross-league Import preserved | 1 | Manual / existing import e2e |
| Shell ASR-4 (Settings, no Import/Billing) | 4 | shell-nav tests + mobile e2e |
| ASR-22 Settings available without league | 3, 4 | Settings Home without Active League |

### Risks & Notes

- Prefer **extract shared League Settings UI** used by `settings/league` rather than duplicating manage page markup.
- Billing redirect must forward query params for Stripe Checkout return.
- Do not put Settings behind `hideWithoutLeague` — Account Settings must remain for users with zero leagues.
- Keep manage redirect access-validated so probing random league IDs still 404s.

# Issue 570 — Active League Navigation Context Implementation Plan

## 1. Product goal and scope boundaries

Establish a secure, server-first Active League foundation for the dashboard. A validated League preference must scope the shell consistently, global switching must replace history and land on League Home, stale preferences must recover deterministically, and accessible resource deep links must synchronize their owning League before rendering.

This issue includes the context resolver, secure persistence boundary, stale recovery, resource-context synchronization primitives/integration, no-League shell state, and focused tests. It does not implement Resource Headers, Season-owned competition routes, Settings relocation, Teams/Divisions consolidation, command-palette canonicalization, or broader visual changes assigned to issues 571–578.

## 2. Current baseline

- `apps/web/src/lib/active-league.ts` reads the client-writable `activeLeagueId` cookie and falls back owned-first/name-sorted, but does not expose whether the preference is missing or stale.
- `apps/web/src/app/dashboard/_components/league-switcher.tsx` writes `document.cookie` and calls `router.refresh()`, retaining the old route/history entry and bypassing server-side validation.
- `apps/web/src/app/dashboard/layout.tsx` renders shell state from the resolver but cannot repair stale cookies and always renders the static sidebar.
- Team, Player, Season, League, Division, and fixture pages validate access independently but do not synchronize the shell’s Active League.
- There is no focused Active League unit or route-handler test coverage.

## 3. Missing capabilities

- A pure, testable deterministic preference-selection model that distinguishes valid, missing, stale, and empty states.
- A server-owned cookie writer that revalidates access and resource existence before mutation.
- A safe internal redirect boundary for stale recovery and pre-render deep-link synchronization.
- Request-path awareness that lets the shell defer stale repair to authorized resource routes without flashing the wrong context.
- Shared synchronization primitives with access-checked integration in League, Team, Player, Season, Division, and fixture pages.
- Context-aware no-League navigation and onboarding access.
- Focused regression coverage for authorization-preserving behavior and replace navigation.

## 4. Milestones

### Phase 1 — Deterministic resolver and persistence boundary

**Goal:** Make Active League selection explicit, deterministic, and server-controlled.

**Deliverables:**
- Refactor `apps/web/src/lib/active-league.ts` around a pure selection function and expose preference status plus active League metadata.
- Add shared cookie options and safe dashboard-return-path helpers in client-safe/server-safe modules.
- Add a server action used by the League switcher to validate the requested League against the authenticated user’s visible set and persisted League data before setting an HttpOnly preference.

**Dependencies:** Existing `resolveOrgContext`, `getLeagues`, and `getLeague` authorization behavior.

**Risks:** React request caching must not retain a pre-mutation resolver result across a follow-up navigation; server action failures must not expose League existence.

**Acceptance criteria:**
- Valid saved preference wins.
- Missing/stale preferences use owned-first, then first visible League deterministically.
- Invalid selections do not mutate the cookie.
- Cookie mutation is server-side only.

### Phase 2 — Server-first recovery and deep-link synchronization

**Goal:** Correct shell context before protected resource content renders.

**Deliverables:**
- Add a protected internal Active League route handler that revalidates the target, safely sets/clears the cookie, and redirects only to normalized dashboard-local paths.
- Extend `apps/web/src/proxy.ts` to pass the current dashboard pathname to server layouts.
- Add a shared server-only synchronization helper and integrate it in League, Team, Player, Season, Division, and fixture pages after each destination’s complete feature, role, ownership, and resource checks.
- Make `apps/web/src/app/dashboard/layout.tsx` redirect stale non-resource requests to deterministic recovery while allowing resource layouts to establish their owning context.

**Dependencies:** Phase 1.

**Risks:** Parent layouts can execute before stricter child-page authorization, so synchronization must remain in the concrete destination after its full checks. Raw owner lookup functions must never trigger mutation before access checks.

**Acceptance criteria:**
- Stale preference redirects to the first accessible League Home, or clears and reaches League onboarding when none exist.
- Accessible cross-League resource links activate the owner and return to the original dashboard path before content is emitted.
- Inaccessible/malformed resources preserve non-disclosing 404 behavior and do not mutate Active League.
- Redirect targets cannot escape `/dashboard`.

### Phase 3 — Switching, history, and no-League shell

**Goal:** Ensure user-driven switching and empty state behavior match the accepted navigation model.

**Deliverables:**
- Update `league-switcher.tsx` to call the validated server action and `router.replace()` the selected League Home.
- Pass Active League availability into desktop/mobile sidebar instances.
- Hide League-scoped destinations when there is no accessible League and expose a prominent League Directory onboarding control while retaining currently valid cross-league destinations pending Settings issue 576.

**Dependencies:** Phases 1–2.

**Risks:** Later issues will replace the temporary cross-league sidebar destinations with canonical Settings and Directory entry points; this issue must avoid conflicting route redesign.

**Acceptance criteria:**
- Switching persists the validated League and replaces history with `/dashboard/leagues/[leagueId]`.
- Desktop and mobile receive identical context state.
- No-League users cannot navigate to empty League-scoped pages from the sidebar and can reach League selection/creation.

### Phase 4 — Focused verification

**Goal:** Lock down context, redirect, and authorization invariants.

**Deliverables:**
- Add `apps/web/src/lib/__tests__/active-league.test.ts` for deterministic selection and route/path classification.
- Add route/action tests for authenticated mutation, stale recovery, local redirect normalization, inaccessible targets, and no-League clearing.
- Add source/component contract tests where needed for replace navigation and conditional sidebar output.
- Run focused Vitest, web type-check, lint on changed files, and relevant navigation Playwright coverage when the configured Clerk/Convex environment is available.

**Dependencies:** Phases 1–3.

**Risks:** Full authenticated Playwright may require external test credentials; report this concretely rather than weakening verification.

**Acceptance criteria:**
- Focused unit tests pass.
- Web type-check passes.
- Existing navigation behavior outside issue scope remains green.

### Phase 5 — Ship and archive

**Goal:** Ship a reviewable conventional commit and close the issue.

**Deliverables:**
- Review the issue-scoped diff, update progress, and commit with `Closes #570`.
- Ship through `arc-git-pr-check --ship merge`.
- After successful merge, archive the synchronized plan/progress artifacts and remove the worktree according to the worktree policy.

**Dependencies:** Phase 4.

**Risks:** Required CI checks may require auto-merge fallback if the canonical ship route reports that merge cannot complete immediately.

**Acceptance criteria:**
- PR is squash-merged and issue 570 closes, or the exact ship blocker is reported.
- Successful merge leaves no issue-570 worktree.

## 5. Acceptance criteria mapping

| Scenario / criterion | Phase(s) | Verification |
| --- | --- | --- |
| Server-first Active League resolution | 1, 2 | Pure resolver tests; route/layout tests; type-check |
| Deterministic stale recovery | 1, 2 | Resolver and recovery route tests |
| Accessible deep link synchronizes owner | 2 | Resource-layout/redirect tests; navigation E2E when available |
| Inaccessible resource does not disclose or mutate | 1, 2, 4 | Negative route/layout tests |
| League switch establishes history boundary | 1, 3 | Switcher contract/component test; E2E when available |
| No-League shell state | 3, 4 | Sidebar rendering test; mobile/desktop E2E when available |
| Existing authorization and data behavior preserved | 1–4 | Existing focused suites and type-check |

## 6. Out of scope / deferred

- Resource Header and breadcrumb replacement (#571).
- League Directory/Home presentation and Active Season shortcuts (#572).
- Teams/Divisions view and Team navigation changes (#573).
- Player hierarchy changes (#574).
- Season-owned competition routes (#575).
- Settings hierarchy (#576).
- Command-palette and final mobile route alignment (#577).
- Full architecture acceptance sweep (#578).

## 7. Immediate next steps

1. Implement Phase 1 with tests.
2. Implement the protected recovery/synchronization boundary and dynamic resource layouts.
3. Update switcher/sidebar behavior and focused tests.
4. Run verification, review, commit, and ship through the canonical PR route.

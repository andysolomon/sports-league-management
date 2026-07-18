# Issue 572 — League Directory and League Home as Workspace Entry Points

## 1. Product goal and scope boundaries

Make League Home the root of the Active League workspace and the League Directory the cross-league entry point. `/dashboard` stops being a standalone overview page and resolves to the Active League's League Home. `/dashboard/leagues` becomes a true cross-league League Directory with per-row Active Season shortcuts. League Home gains a prominent Open Active Season action and an ASR-14-compliant no-active-season state. Discover is surfaced from the League Directory only.

Primary requirements: ASR-1, 4 (partial: Leagues/Discover removal), 6, 9, 10, 12, 13, 14, 21, 22. Language lock per CONTEXT.md (League Directory / League Home / Active League / Active Season / Discover).

Out of scope, owned by later issues: Divisions consolidation and sidebar Divisions removal (#573), `?from=` cleanup (#574), Season-owned competition routes (#575), Settings branch and Import/Billing sidebar removal (#576), command palette canonicalization (#577), acceptance sweep (#578).

**Scope decision needing approval:** `/dashboard` becoming a redirect retires the bento overview page (stat strip, gauges, sparkline, heatmap, map, recent results) and its private components/tests. CONTEXT.md resolves "Overview" to mean League Home, and League Home (WSM-000254) already carries current-season context, standings snapshot, and teams grid — but the bento widgets themselves are not re-homed by this issue. If any widget must survive, it should be a follow-up issue against League Home.

## 2. Current baseline (verified at ec71ff3)

- `apps/web/src/app/dashboard/page.tsx` renders the bento overview; its quick-nav strip links to `/dashboard/leagues`, `/dashboard/divisions`, `/dashboard/discover`.
- `apps/web/src/app/dashboard/leagues/page.tsx` renders only the *active* league's card with a divisions accordion and admin rename/delete — not a cross-league directory.
- `sidebar.tsx` still lists Leagues and Discover as top-level items; Overview points at `/dashboard`. `nav-link.tsx` special-cases exact `/dashboard` for active styling.
- League Home (`leagues/[id]/page.tsx`) has a ResourceHeader with Manage/Seasons actions but no Open Active Season action; `LeagueCurrentSeasonCard` renders a bare "No active season." with no links.
- `/dashboard/active-league/route.ts` (#570) validates league access via `getLeague(orgContext)` before setting the HttpOnly cookie and redirects to a normalized `returnTo` — the exact mechanism ASR-9 shortcuts need.
- League switcher persists via server action and `router.replace()` to League Home (ASR-12 already satisfied); it has no League Directory link yet.

## 3. Milestones

### Phase 1 — Navigation primitives

- `resource-navigation.ts`: add `leagueDirectoryHref()` (`/dashboard/leagues`) and `activeSeasonShortcutHref(leagueId, seasonId)` returning `/dashboard/active-league?leagueId=…&returnTo=/dashboard/seasons/[seasonId]` — the shortcut persists the owning League as Active (server-validated) before Season Home renders (ASR-9, ASR-24), reusing the #570 route rather than adding a new mutation surface.
- Unit tests for both helpers (encoding, returnTo shape).

**Acceptance:** helpers pure and tested; no behavior change yet.

### Phase 2 — Shell chrome

- `sidebar.tsx`: remove Leagues and Discover items; Overview emits the canonical Active League Home URL `/dashboard/leagues/[activeLeagueId]` (ASR-6) via a new `activeLeagueId` prop threaded from `layout.tsx` and `mobile-header.tsx` (ASR-13 parity). No-league state (ASR-22) keeps the existing League Directory onboarding link and hides league-scoped items (already in place from #570); Import/Billing/Divisions stay until #573/#576.
- `nav-link.tsx`: replace the exact-`/dashboard` special case so Overview is active on League Home and its children but not on `/dashboard/leagues` (Directory).
- `league-switcher.tsx`: append a "League Directory" item linking to `/dashboard/leagues` (CONTEXT: the switcher links to the League Directory).
- Update `active-league-navigation.test.ts` sidebar expectations.

**Acceptance:** desktop and mobile expose identical destinations; Discover reachable only via Directory after Phase 3.

### Phase 3 — Pages

- `/dashboard/page.tsx` → server redirect: unauthenticated → `/sign-in`; no accessible League → `/dashboard/leagues` (Directory onboarding, ASR-10/22); otherwise → `/dashboard/leagues/[activeLeagueId]` (ASR-21). Delete `_components/bento/*`, `_components/overview/*` and their tests (`bento.test.ts`, `dashboard-overview.test.ts`) — inventory confirms no other production importers.
- `/dashboard/leagues/page.tsx` → League Directory: heading "League Directory"; one row per visible league (name, org/public badge — per-row team/player counts deliberately omitted: cross-league entity fetches risk the Convex 8192-element return cap, WSM-000189); row primary action navigates via `/dashboard/active-league?leagueId=X&returnTo=/dashboard/leagues/X` so selection persists Active League before League Home renders (ASR-1); secondary Active Season shortcut per row via `activeSeasonShortcutHref`, omitted when that league has no `status === "active"` season (ASR-9/14); Create League button retained; Discover entry ("Find public leagues") lives here; per-row admin rename/delete retained for org-admin leagues (existing `leagues-actions` components). Divisions accordion removed (Divisions remain at `/dashboard/divisions` until #573).
- League Home: ResourceHeader gains a prominent "Open Active Season" action → `/dashboard/seasons/[seasonId]` when an active season exists; `LeagueCurrentSeasonCard` no-active-season state gains a Seasons Home link for all users plus an admin-only manage-seasons CTA (creation/activation live on Seasons Home; DynastyPanel keeps its lifecycle actions) (ASR-14).

**Acceptance:** entry points match ASR-21/22; no access-model changes; canonical URLs only.

### Phase 4 — Verify and ship

- Update affected e2e specs (from the blast-radius inventory): `health.spec.ts`, `navigation.spec.ts` (NAV_ITEMS), `mobile-navigation.spec.ts` (NAV_LABELS), `dashboard-tree-convex.spec.ts`, rewrite `leagues.spec.ts` for the Directory, replace `dashboard-overview.spec.ts` with a `/dashboard` redirect spec.
- `pnpm --filter @sports-management/web type-check`, `lint`, `test:unit` locally; Playwright in CI only. Visual-regression drift is non-blocking.
- Conventional commit (`feat: …`, `Closes #572`), push, ship via `arc-git-pr-check --ship merge`; verify the squash contains `apps/` files before merge; archive plan/progress to `docs/archive/issue-572-*`, remove worktree, close issue.

## 4. Acceptance criteria mapping

| Criterion | Phase | Verification |
| --- | --- | --- |
| `/dashboard` resolves to League Home / Directory onboarding (ASR-21/22/10) | 3 | redirect unit test + health/navigation e2e |
| Directory selection persists Active League then League Home (ASR-1) | 1, 3 | helper tests, route tests (existing), leagues e2e |
| Active Season shortcuts activate League first (ASR-9/24) | 1, 3 | `activeSeasonShortcutHref` tests + Directory/League Home e2e |
| No-active-season state (ASR-14) | 3 | LeagueCurrentSeasonCard test + e2e |
| Sidebar canonical, Leagues/Discover removed, viewport parity (ASR-4 partial, 6, 13) | 2 | sidebar tests, navigation + mobile e2e |
| Switcher history boundary preserved (ASR-12) | 2 | existing switcher tests remain green |
| No authorization change (ASR-5) | all | existing route/action tests remain green |

## 5. Review outcomes (independent pre-ship review)

Applied: removed League Home's generic "Seasons" header action (ASR-21 — contextual actions only); extracted shared `findActiveSeason` into `season-view.ts` so League Directory and League Home resolve a multi-active-season conflict identically (newest wins); language-lock renames ("Active Season" card title, "Active League" badge) with spec updates.

Deferred as follow-ups (to be captured in the #578 acceptance sweep): behavioral e2e coverage of Directory selection/persistence and per-role admin gating across multiple fixture leagues; batching the Directory's per-org role lookups into a single membership fetch.

## 6. Risks

- The `/dashboard` redirect adds one hop for legacy `/dashboard` links (marketing CTAs, welcome email, join flow) — acceptable; they remain valid.
- Directory now fetches seasons across all visible leagues for shortcut presence; seasons-per-league counts are small, far below the Convex 8192 return cap that bit the old dashboard (WSM-000189).
- e2e suite touches shared-league fixtures; follow the isolation conventions from WSM-000172.

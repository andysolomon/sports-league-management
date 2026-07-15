# League Workspace Navigation — Architecturally Significant Requirements

**Status:** Accepted
**Date:** 2026-07-15

This document records the requirements that materially shape routing, context propagation, authorization, compatibility, and test strategy for the league workspace navigation redesign.

## ASR-1 — Active League context

The operator has at most one Active League. League-specific navigation and content must resolve against that League. Selecting a League from either the global switcher or League Directory must persist it as active and navigate to its League Home at `/dashboard/leagues/[leagueId]`.

## ASR-2 — Hub-and-spoke navigation

League, Team, Player, and Season resources must each have a canonical Home from which their subordinate pages branch. Primary resource-selection interactions must navigate to these Homes; transient drawers may only be explicit secondary actions.

## ASR-3 — Season-owned competition routes

Schedule, standings, playoffs, and statistics must be canonical child routes of `/dashboard/seasons/[seasonId]`. Existing League-owned routes using `?season=` must redirect to the equivalent Season-owned route so saved links remain usable.

## ASR-4 — League-scoped global navigation

The sidebar must contain only Overview, Teams, Players, Seasons, and Settings. Overview resolves to the Active League’s League Home. Leagues, Divisions, Discover, Import, and Billing must not appear as top-level sidebar items.

## ASR-5 — Existing access boundaries

Navigation changes must preserve server-side authorization, non-disclosing 404 behavior for inaccessible resources, role-gated management affordances, and feature-flag gating. Persisted Active League state must never grant or imply access.

## ASR-6 — Compatibility and canonicalization

Removed or relocated first-party routes must redirect to their canonical replacement when the target can be resolved without weakening access checks. New links and navigation controls must emit only canonical URLs.

## ASR-7 — Orientation without breadcrumbs

Dashboard pages must not render breadcrumb trails or generic “Back to …” rows. A child page must instead use a stable Resource Header that identifies and links its parent Home and exposes sibling subpage navigation. The topbar retains its history-based Back control.

## ASR-8 — Explicit Settings ownership scopes

`/dashboard/settings` must branch to League Settings at `/dashboard/settings/league` and Account Settings at `/dashboard/settings/account`. League Settings operates on the Active League. Account Settings owns cross-league Import and user-owned Billing. Import must continue to create or update the League identified by its payload rather than being forced into the previously Active League. Existing `/dashboard/import`, `/dashboard/billing`, and League manage URLs must redirect to canonical Settings routes where authorization allows.

## ASR-9 — Direct Active Season access

League Home must provide a prominent action to the Active Season’s Season Home, while each League Directory row provides a secondary Active Season shortcut. Following either shortcut must first persist the associated League as Active and then navigate directly to `/dashboard/seasons/[seasonId]`.

## ASR-10 — Stale Active League recovery

If the persisted Active League is deleted or inaccessible, the application must discard it, select the first accessible League deterministically, and redirect to that League Home. If no League is accessible, it must show League Directory onboarding. Recovery must retain non-disclosing authorization behavior and must not reveal whether an inaccessible League exists.

## ASR-11 — Settings authorization

Settings Home and Account Settings must remain available to every authenticated user. League Settings must be discoverable only to Org Admins of the Active League; unauthorized direct access must retain non-disclosing 404 behavior. Coaches must reach team-management capabilities from Team Home rather than League Settings.

## ASR-12 — League-switch history boundary

Changing League through the global switcher must replace the current browser history entry while navigating to the new League Home. Back navigation must not reopen a route whose implicit Active League scope belonged to the previous context.

## ASR-13 — Navigation parity across viewports

Desktop and mobile navigation must expose the same destinations and League-switch behavior. Mobile selection must close the navigation drawer. Mobile must not introduce a breadcrumb substitute.

## ASR-14 — No Active Season state

The UI must not treat an upcoming or completed Season as Active. When a League has no Active Season, League Home must show “No active season,” link to Seasons Home, and expose valid creation or activation actions only to authorized Org Admins. League Directory must omit its Active Season shortcut for that League.

## ASR-15 — Legacy Season URL resolution

A valid legacy League competition URL with `?season=[id]` must permanently redirect to the corresponding Season child route. Without `?season=`, it must resolve the League’s Active Season; if none exists, it must activate that accessible League and redirect to Seasons Home. Invalid, inaccessible, or League-mismatched identifiers must return a non-disclosing 404 rather than falling back.

## ASR-16 — Teams/Divisions view state

Teams Home must use `/dashboard/teams` for its Teams view, `?view=divisions` for its Divisions view, and `&division=[divisionId]` for a selected Division. View changes must create browser history entries. Legacy Division URLs must permanently redirect only after validating access and League ownership.

## ASR-17 — Resource deep-link context synchronization

Opening an accessible Team, Player, Season, or child deep link must synchronize Active League to the resource’s owning League before rendering. The shell, switcher, global destinations, and resource content must never disagree about League context. Inaccessible resources must retain non-disclosing 404 behavior and must not mutate Active League.

## ASR-18 — Team navigation hierarchy

Team Home must expose Overview, Roster, and Depth Chart as primary sibling destinations in its Resource Header. Roster Audit remains a child of Roster; live and statistics game pages remain contextual destinations. Authorized Team management actions remain on Team Home rather than moving into global Settings.

## ASR-19 — Player navigation hierarchy

Player Home must initially expose Overview and Development as primary sibling destinations. Ratings, season statistics, and editable attributes remain sections of Overview. The legacy `?from=` mechanism and generated “Back to …” links must be removed in favor of Resource Headers and browser history.

## ASR-20 — Season navigation hierarchy

Season Home must expose Overview, Schedule, Standings, Playoffs, and Stat Leaders as primary sibling destinations, omitting feature-disabled destinations. Position-group attribute ingestion remains a contextual management workflow rather than a primary Season destination.

## ASR-21 — League Home as workspace root

League Home must be the root of the Active League workspace. Overview, Teams, Players, Seasons, and Settings in global navigation are its primary branches and must not be duplicated by a local League tab bar. League Home’s header must contain only contextual actions such as Open Active Season and authorized League Settings.

## ASR-22 — Navigation without a League

When no League is accessible, Overview, Teams, Players, and Seasons must be hidden; Account Settings remains available. The shell must prominently link to League Directory onboarding for League selection or creation and restore League-scoped navigation after activation.

## ASR-23 — Command palette consistency

The command palette must remain available and emit only canonical Home and child routes. Opening a League or cross-League resource through the palette must apply the same Active League synchronization rules as direct navigation. Obsolete standalone Leagues and Divisions navigation commands must be removed, while League Directory remains reachable as an explicit cross-league command.

## ASR-24 — Server-first context consistency

Active League resolution and deep-link synchronization must complete server-side before resource content or shell state renders. The interface must not flash content, switcher state, or active navigation for the wrong League; client-only post-render correction is not acceptable.

## ASR-25 — Navigation verification

Verification must include unit tests for context resolution, canonical URL construction, and legacy redirects; component tests for role- and context-aware navigation and Resource Headers; and desktop/mobile Playwright flows covering League switching, Active Season shortcuts, Home-to-child navigation, Divisions view history, deep-link synchronization, and breadcrumb removal. Authorization tests must prove inaccessible resources still return non-disclosing 404 responses. Type-check and existing relevant suites must remain green.

## Scope boundary

This effort changes information architecture, canonical routes, navigation controls, Resource Headers, redirects, and related tests. Existing page content, data behavior, permissions, and visual design must remain unchanged except where layout must adapt to support the new navigation.

A broader content or visual redesign is out of scope; the recently implemented Leagues, Teams, Players, Seasons, schedule, standings, and playoffs presentation remains the baseline.

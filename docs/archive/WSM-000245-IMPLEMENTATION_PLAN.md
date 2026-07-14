# WSM-000245 — Leagues & Seasons Operator-Shell Visual Overhaul

**Mode:** Gap  
**Story:** WSM-000245 / GitHub #547  
**Source prototype:** `docs/design_handoff/prototypes/Leagues & Seasons - Prototype.html`  
**Foundation:** WSM-000235 (#523) — lifecycle workspace already shipped (PRs #533–#544)

## Product goal and scope

Recreate the approved prototype’s **operator-shell visual language** and hub-surface polish in the production Next.js/Convex app. Navigation IA already matches the prototype (Overview → Billing). This epic closes the remaining visual/composition gap without porting the prototype’s bundled React/localStorage runtime.

### In scope
- Persistent dashboard shell (sidebar, desktop/mobile header, brand, active states)
- League hub / season hub header composition aligned to prototype
- Teams table + team detail sheet
- Players directory (cards/list) and Divisions dual-panel polish
- Schedule / standings / playoffs surface polish (look only; lifecycle ops already shipped)
- League manage surface polish
- Visual regression + mobile parity

### Out of scope
- Discover / Import / Billing feature work (stubs in both prototype and production)
- Porting prototype accent selector, tweaks panel, or localStorage domain data
- Recreating WSM-000235 lifecycle mutations/flows
- New league creation beyond existing production capabilities

## Current baseline

- Sidebar IA already identical: `apps/web/src/app/dashboard/_components/sidebar.tsx`
- Dashboard chrome: `apps/web/src/app/dashboard/layout.tsx` (`w-56` aside, league switcher header)
- Unified workspace: `apps/web/src/components/workspace/WorkspaceHeader.tsx`, `WorkspaceNav.tsx`
- Season hub, schedule week accordions, gamecast drawer, standings, playoffs: shipped under WSM-000235
- Teams routes exist under `apps/web/src/app/dashboard/teams/`

## Missing capabilities (gaps)

1. Shell visual language vs prototype (active pill, brand mark, header density/placement)
2. Hub headers still WSM-000236 style; prototype uses denser CTA banners + cross-links
3. Teams list/detail sheet not at prototype fidelity
4. Players cards/list and Divisions dual-panel polish
5. Schedule/standings/playoffs visual polish deltas
6. League manage settings rows visual polish

## Milestones

### Phase 1 — WSM-000246: Operator shell reskin
- **Goal:** Highest-visibility chrome match with zero data/route changes
- **Deliverables:** Update `layout.tsx`, `sidebar.tsx`, `nav-link.tsx`, `mobile-header.tsx` (+ related header atoms) to prototype shell look using existing tokens
- **Dependencies:** none
- **Risks:** visual-regression baseline churn; accidental removal of DensityToggle/CommandPalette
- **Acceptance:** AC on #WSM-000246 / child issue; lint + unit green; navigation smoke

### Phase 2 — WSM-000247: Hub headers
- Align `WorkspaceHeader` / `WorkspaceNav` / breadcrumbs usage on league hub + season hub to prototype composition (lifecycle banners stay behavioral)

### Phase 3 — WSM-000248: Teams table + detail sheet
- Ranked teams table and right-sheet detail matching prototype fields (record, form, key players) using production data APIs

### Phase 4 — WSM-000249: Players + Divisions polish
- Players cards/list + filters; Eastern/Western dual-panel divisions

### Phase 5 — WSM-000250: Season play surfaces polish
- Schedule accordions, standings clinch/cut presentation, playoffs empty/seed CTA look

### Phase 6 — WSM-000251: League manage polish
- Settings rows / danger zone composition

### Phase 7 — WSM-000252: Visual regression + ship
- Update visual baselines; mobile pass; close epic; archive plan/progress

## Immediate next steps
1. Open child issues WSM-000246–252 linked to #547
2. Implement Phase 1 (shell reskin) on `feat/WSM-000246-operator-shell-reskin`
3. Verify and open PR closing WSM-000246

## Deferred
- Discover/Import/Billing productization
- Prototype tweaks/accent panel

# Issue 577 — Align mobile navigation and command palette with canonical routes

## 1. Product goal and scope boundaries

Bring desktop/mobile shell destinations and the ⌘K command palette in line with the post-#572/#573/#575 canonical navigation model (ASR-13, ASR-23), without waiting on Settings (#576) or Players cleanup (#574).

**In scope**
- Command palette destination list and League activation paths
- Mobile/desktop destination parity for the shared `Sidebar` shell (already largely shared; verify + extend tests)
- Drawer-close behavior on mobile nav selection (already wired via `onNavigate`; verify coverage)
- Unit + focused Playwright verification

**Out of scope / deferred**
- Settings Home / Import+Billing relocation (#576)
- Players Home / `?from=` cleanup (#574)
- Full navigation acceptance sweep (#578)
- Changing Season-owned competition routes (#575 already shipped)

## 2. Current baseline

- `sidebar.tsx` already exposes Overview → Active League Home, Teams, Players, Seasons, Import, Billing; no-league state shows League Directory onboarding; Divisions/Discover/Leagues removed from the rail (#572/#573).
- `mobile-header.tsx` mounts the same `Sidebar` inside a Sheet and passes `onNavigate={() => setOpen(false)}` (ASR-13 drawer close). League switcher + HistoryBackButton live in the mobile chrome (not a breadcrumb trail).
- `command-palette.tsx` is stale relative to ASR-4/ASR-23:
  - Navigate group still lists **Leagues**, **Discover**, **Divisions**, **Roles & permissions**
  - Overview hard-codes `/dashboard` instead of Active League Home
  - League group uses bare `router.push(/dashboard/leagues/${id})` instead of `leagueActivationHref` (Directory/switcher pattern)
- #572 plan explicitly deferred palette canonicalization to #577.

## 3. Missing capabilities

| Gap | ASR | Fix |
| --- | --- | --- |
| Palette still offers standalone Divisions / Leagues / Discover / Roles | ASR-4, ASR-23 | Remove obsolete commands; keep **League Directory** as the explicit cross-league command |
| Palette Overview ≠ sidebar Overview | ASR-6, ASR-13, ASR-21 | Resolve Overview via `leagueHomeHref(activeLeagueId)` / directory fallback |
| Palette League picks skip activation handler | ASR-1, ASR-23 | Use `leagueActivationHref(league.id)` |
| No shared source of truth for shell destinations | ASR-13 | Extract a small nav-destination helper consumed by sidebar + palette (or keep sidebar as source and build palette NAV from the same helpers) |
| Mobile/palette e2e do not assert canonical palette commands | ASR-13, ASR-23, ASR-25 | Extend `mobile-navigation.spec.ts` + add unit coverage for palette destination contracts |

## 4. Milestones / phases

### Phase 1 — Shared destination helpers + palette rewrite

**Goals:** Palette emits only canonical shell destinations; League picks activate Active League.

**Deliverables**
- Thread `activeLeagueId` into `CommandPalette` from `layout.tsx` (same value already passed to sidebar/mobile header).
- Rewrite `NAV` in `command-palette.tsx`:
  - Overview → Active League Home when `activeLeagueId` is set, else League Directory
  - Teams / Players / Seasons (unchanged)
  - League Directory (rename; href `/dashboard/leagues`)
  - Import / Billing (remain until #576 so palette matches current sidebar)
  - Remove Divisions, Discover, Roles, and the obsolete “Leagues” label
- League group `onSelect` → `go(leagueActivationHref(league.id))`
- Prefer extracting pure helpers (e.g. `buildShellNavItems(activeLeagueId)` / `buildPaletteNavItems(...)`) under `apps/web/src/app/dashboard/_components/` or `resource-navigation.ts` so sidebar and palette cannot drift.

**Dependencies:** none (uses helpers from #572)

**Risks:** Discover must remain reachable from League Directory only — do not re-add it to the rail or palette Navigate group.

**Acceptance criteria**
- [ ] Palette Navigate group contains no Divisions / Discover / Roles / “Leagues” labels
- [ ] League Directory remains selectable
- [ ] Overview matches sidebar Active League Home resolution
- [ ] Selecting a League in the palette goes through `/dashboard/active-league?...`

### Phase 2 — Viewport parity verification (mobile)

**Goals:** Confirm ASR-13: same destinations + drawer close; no breadcrumb substitute introduced.

**Deliverables**
- Audit `mobile-header.tsx` / `sidebar.tsx`: no new breadcrumb UI; keep HistoryBackButton as history affordance only
- Extend `apps/web/e2e/tests/mobile-navigation.spec.ts`:
  - Sheet destinations match desktop sidebar labels (Overview, Teams, Players, Seasons, Import, Billing when leagues exist)
  - Selecting a link closes the sheet (already partially covered)
  - No “Divisions” / “Discover” / “Leagues” top-level links in the sheet
- Optional: desktop navigation smoke that palette opens (⌘K / trigger) and League Directory command is present while Divisions is absent — prefer unit test if Playwright key-modifier flakiness is high

**Dependencies:** Phase 1

**Risks:** Import/Billing still in shell until #576 — tests must expect them, not Settings Home.

**Acceptance criteria**
- [ ] Mobile sheet and desktop sidebar expose the same destination set
- [ ] Sheet closes on nav selection
- [ ] No breadcrumb substitute added on mobile

### Phase 3 — Tests + type-check

**Goals:** Lock contracts; keep suites green.

**Deliverables**
- Unit tests: `apps/web/src/app/dashboard/_components/__tests__/command-palette-nav.test.ts` (or extend `active-league-navigation.test.ts`) asserting destination list + `leagueActivationHref` usage
- Update any snapshots/assertions that still expect palette Divisions/Discover
- `pnpm --filter @sports-management/web type-check`
- Focused Playwright: `mobile-navigation.spec.ts` (+ navigation.spec.ts if touched)

**Acceptance criteria**
- [ ] New/updated unit tests pass
- [ ] Focused Playwright green
- [ ] Type-check green

## 5. Out-of-scope / deferred

- Settings branching and Import/Billing removal from the shell (#576)
- Players Resource Header / legacy `?from=` (#574)
- Epic-wide verification matrix (#578)
- Visual-regression baseline updates unless a shared shell snapshot fails and is clearly caused by this work

## 6. Immediate next steps

1. Create branch `feat/issue-577-mobile-palette-nav` from updated `main`.
2. Implement Phase 1 (palette + helpers).
3. Phase 2–3 tests, then ship PR with `Closes #577`.

## Implementation Plan (task checklist)

**Story:** #577 Align mobile navigation and command palette with canonical routes  
**Branch:** `feat/issue-577-mobile-palette-nav`

### Analysis

Sidebar/mobile already share destinations and drawer-close. The blocking drift is `command-palette.tsx`, still advertising pre-Wayfinder destinations and bare League pushes. Align the palette to ASR-23 and prove ASR-13 with mobile e2e.

### Tasks

- [ ] **1. Thread Active League into CommandPalette**
  - Files: `apps/web/src/app/dashboard/layout.tsx`, `apps/web/src/app/dashboard/_components/command-palette.tsx`
  - Details: Pass `activeLeagueId` alongside `leagues`.

- [ ] **2. Canonicalize palette Navigate destinations**
  - Files: `command-palette.tsx`, optional shared helper next to sidebar
  - Details: Overview → League Home; League Directory; drop Divisions/Discover/Roles/Leagues; keep Import/Billing until #576.

- [ ] **3. Palette League activation via `leagueActivationHref`**
  - Files: `command-palette.tsx`, `resource-navigation.ts` (reuse)
  - Details: Replace bare `/dashboard/leagues/${id}` pushes.

- [ ] **4. Unit tests for palette destination contracts**
  - Files: `apps/web/src/app/dashboard/_components/__tests__/command-palette-nav.test.ts` (new) and/or `active-league-navigation.test.ts`

- [ ] **5. Mobile Playwright parity + drawer close**
  - Files: `apps/web/e2e/tests/mobile-navigation.spec.ts`

- [ ] **6. Type-check + focused e2e**
  - Commands: `pnpm --filter @sports-management/web type-check`; Playwright `mobile-navigation.spec.ts`

### Test Strategy

- [ ] **Unit:** palette nav item hrefs/labels; League activation href shape
- [ ] **E2E:** mobile sheet destination parity + close-on-navigate; no obsolete top-level links
- [ ] **Manual QA:** ⌘K → League Directory; ⌘K → pick other League → switcher shows new Active League; mobile hamburger → Overview lands on League Home

### Acceptance Criteria Mapping

| Criterion | Task(s) | How Verified |
| --- | --- | --- |
| ASR-13 same destinations across viewports | 2, 5 | Unit + mobile Playwright |
| ASR-13 mobile selection closes drawer | 5 | `mobile-navigation.spec.ts` |
| ASR-13 no breadcrumb substitute | 5 | Audit + e2e (no breadcrumb UI) |
| ASR-23 palette canonical Homes only | 2, 4 | Unit assertions on NAV |
| ASR-23 remove obsolete Leagues/Divisions commands | 2, 4, 5 | Unit + e2e absence checks |
| ASR-23 League Directory remains | 2, 4 | Unit + e2e |
| ASR-23 Active League sync on palette League open | 3, 4 | Unit href + manual/e2e switcher state |
| Import/Billing unchanged until #576 | 2 | Explicit keep in NAV matching sidebar |

### Risks & Notes

- Do not invent Settings Home here; #576 owns that move.
- Prefer `leagueActivationHref` over relying only on League Home’s `syncActiveLeagueForResource` so palette matches Directory semantics (ASR-1).
- `#574` still open but not a hard blocker for shell/palette work.

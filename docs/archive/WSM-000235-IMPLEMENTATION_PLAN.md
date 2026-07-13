# WSM-000235 — Leagues & Seasons Dynasty Lifecycle Overhaul

## Implementation Plan

**Story:** WSM-000235 / GitHub #523 — Leagues & Seasons dynasty lifecycle overhaul  
**Delivery branches:** one branch per child story, `feat/WSM-000236-*` through `feat/WSM-000244-*`  
**Epic:** https://github.com/andysolomon/sports-league-management/issues/523

## 1. Product goal and scope boundaries

Recreate the approved `docs/design_handoff/prototypes/leagues-seasons/` lifecycle in the production Next.js/Convex app: regular-season completion → playoff seeding → round progression → explicit championship → season completion → explicit dynasty rollover → upcoming-season offseason.

The overhaul must compose existing production capabilities rather than porting prototype runtime code. Production data remains in Convex behind the existing authenticated data API and server actions. App shadcn primitives and existing tokens remain the production component foundation.

Scope includes child stories WSM-000236 through WSM-000244. Each child ships on its own branch and PR so regressions can be isolated and dependency order enforced.

## 2. Current baseline

- League, season archive, and season hub routes already exist under `apps/web/src/app/dashboard/leagues/` and `apps/web/src/app/dashboard/seasons/`.
- Schedule generation, result entry, simulation, season switching, and standings already exist. Schedule weeks are flat cards in `apps/web/src/app/dashboard/leagues/[id]/schedule/page.tsx`.
- Playoff bracket generation and single/double-elimination rendering exist in `apps/web/src/app/dashboard/leagues/[id]/playoffs/`, `apps/web/src/components/playoffs/`, and `apps/web/convex/lib/bracket.ts`.
- Full-page Gamecast is already implemented under `apps/web/src/app/dashboard/games/[fixtureId]/gamecast/` and `apps/web/src/components/gamecast/`.
- Season completion and dynasty rollover exist in `apps/web/convex/sports.ts`, `apps/web/src/app/dashboard/seasons/`, `apps/web/src/app/dashboard/_actions/dynasty.ts`, and `apps/web/src/components/dynasty/DynastyPanel.tsx`.
- Synthetic roster and attribute generation exist behind server actions and feature flags.
- Native `window.confirm` remains in schedule simulation, playoff advancement, dynasty, and synthetic roster controls.
- Theme persistence already uses `next-themes`; density and season simulation flavor do not exist. Playoff size exists on the season.
- Current tests cover the individual domains, including `seasonCrud`, `completeSeason`, `dynastyRollover`, schedule simulation, playoff generation/advancement, Gamecast, seasons, playoffs, and dynasty E2E.

## 3. Missing capabilities

1. A consistent League/Season workspace and lifecycle-oriented page hierarchy matching the handoff.
2. Accessible reusable confirmation and blocking-process feedback in place of native browser dialogs.
3. Complete backend enforcement of completed-season immutability and consistent season fallback rules.
4. Lifecycle-aware schedule accordions and a direct schedule-to-playoffs handoff.
5. A contextual preview/final drawer shared by regular-season and playoff matchups.
6. Round-scoped playoff controls where bulk simulation stops before the championship.
7. Guided generation flows and actionable undersized-roster auto-fill.
8. Explicit consecutive completion and rollover UX with truthful operation summaries.
9. Correctly scoped display preferences and season simulation settings.

## 4. Milestones and ordered tasks

### Phase 1 — WSM-000236: unified League and Season workspace

**Goal:** Establish the shared information architecture and visual shell without changing lifecycle behavior.

**Deliverables**

- Add a reusable workspace header/navigation composition under `apps/web/src/components/leagues/` or `apps/web/src/components/seasons/` using existing app primitives.
- Refactor:
  - `apps/web/src/app/dashboard/leagues/[id]/page.tsx`
  - `apps/web/src/app/dashboard/seasons/[id]/page.tsx`
  - `apps/web/src/app/dashboard/leagues/[id]/schedule/page.tsx`
  - `apps/web/src/app/dashboard/leagues/[id]/standings/page.tsx`
  - `apps/web/src/app/dashboard/leagues/[id]/playoffs/page.tsx`
  - `apps/web/src/app/dashboard/leagues/[id]/stats/page.tsx`
- Keep `SeasonSwitcher`, league CRUD, feature-flagged controls, and `OffseasonHub` functional.
- Add/update navigation and visual coverage in `apps/web/e2e/tests/navigation.spec.ts`, `leagues.spec.ts`, `seasons.spec.ts`, and `visual-regression.spec.ts`.

**Dependencies:** none.  
**Risks:** broad visual diff; accidentally exposing prototype-only controls; route query loss when moving between season views.

**Acceptance criteria**

- League/season routes share consistent context, status, and navigation.
- “Back to League” always targets `/dashboard/leagues/[id]`.
- Unsupported prototype controls are absent, while existing flagged production controls remain intact.
- Dark/light and mobile layouts remain usable.

### Phase 2 — WSM-000237: accessible confirmation and process foundation

**Goal:** Remove native lifecycle dialogs and provide reusable, truthful action feedback.

**Deliverables**

- Add shared client components such as:
  - `apps/web/src/components/lifecycle/ActionConfirmDialog.tsx`
  - `apps/web/src/components/lifecycle/ProcessDialog.tsx`
  - focused component tests under `apps/web/src/components/lifecycle/__tests__/`
- Compose `ui/alert-dialog.tsx` and `ui/dialog.tsx`; implement focus restoration, pending-state locking, live announcements, retry, and operation result summaries.
- Replace every native confirmation in the approved lifecycle scope, explicitly including:
  - `apps/web/src/components/schedule/SimulateControls.tsx`
  - `apps/web/src/components/schedule/GenerateScheduleButton.tsx`
  - `apps/web/src/components/schedule/DeleteFixtureButton.tsx`
  - `apps/web/src/components/schedule/GoLiveControl.tsx`
  - `apps/web/src/components/schedule/ClipsControl.tsx`
  - `apps/web/src/components/playoffs/AdvanceToPlayoffsButton.tsx`
  - `apps/web/src/components/playoffs/GeneratePlayoffsButton.tsx`
  - `apps/web/src/components/dynasty/DynastyPanel.tsx`
  - `apps/web/src/components/roster/SyntheticRosterButton.tsx`
  - `apps/web/src/components/stats/StatsEntry.tsx` for clear/edit game-stat confirmation
  - completion, force-completion, activation, copy-roster, and delete flows in `apps/web/src/app/dashboard/seasons/season-actions.tsx`.
- Do not fabricate timed progress. Show request/processing state while awaiting an action, then populate operation-specific completed steps from the server response.

**Dependencies:** Phase 1 only where shared placement is needed.  
**Risks:** Radix nested-trigger mistakes; closing during mutation; regression in action-specific error handling.

**Acceptance criteria**

- No native confirm/alert remains in scoped lifecycle components.
- Dialogs are keyboard operable and restore focus.
- Duplicate submission and committed-action dismissal are prevented.
- Errors remain actionable and retryable.

### Phase 3 — WSM-000238: server-side lifecycle invariants

**Goal:** Make lifecycle correctness independent of UI state.

**Deliverables**

- Add central season-state guards in `apps/web/convex/sports.ts` or a focused `apps/web/convex/lib/seasonLifecycle.ts` helper.
- Inventory every fixture-derived write and classify it before applying guards at the lowest shared mutation boundary:
  - **Competition-state writes blocked after completion:** create/update/delete fixture, record/edit result, generated schedule replacement, simulated result persistence, live-score state/finalization, game-log/stat create/update/clear, and playoff generation/reseeding/advancement.
  - **Historical media writes intentionally allowed after completion:** asynchronous stream-provider/VOD status webhooks and game-clip create/delete, because they annotate archived media without changing competition outcomes. Operator “go live” creation remains blocked after completion. Add explicit allow/block tests for `createGameStream`, provider status updates, `createGameClip`, and clip deletion so the exception cannot broaden accidentally.
- Change `setActiveSeason` so completed seasons cannot be reactivated; update the former “escape hatch” tests in `apps/web/convex/__tests__/completeSeason.test.ts`.
- Define the approved state machine explicitly: `active` decided season → `completed` source season → rollover from the newest eligible completed season → one `upcoming` season → activation. Rollover source resolution must no longer require an active season after completion.
- Add persisted rollover lineage/state, preferably a `seasonRollovers` table indexed uniquely by source season and by target season: `{ leagueId, sourceSeasonId, targetSeasonId, status, stage, startedAt, completedAt?, lastError? }`. A transactional begin mutation claims the completed source and creates/links exactly one upcoming target; idempotent stage mutations update progress; retry resumes the same operation rather than creating another season. This provides proof for already-rolled-over rejection after later activation.
- Align `apps/web/src/lib/season-view.ts`, `apps/web/src/app/dashboard/_actions/synthetic-rosters.ts`, Convex `currentSeasonId`, and dynasty source-season resolution with that state machine.
- Preserve read paths for archive, standings, statistics, box score, and Gamecast.
- Extend:
  - `apps/web/convex/__tests__/seasonCrud.test.ts`
  - `apps/web/convex/__tests__/completeSeason.test.ts`
  - `apps/web/convex/__tests__/currentSeasonId.test.ts`
  - schedule/playoff action tests
  - `apps/web/src/lib/__tests__/season-view.test.ts`

**Dependencies:** none; merge before mutation-heavy UI phases.  
**Risks:** existing tests intentionally permit reactivation; internal callers may rely on the old fallback; mutation errors must map to stable UI codes.

**Acceptance criteria**

- Completed seasons reject all scoped writes but remain readable.
- Reactivation is rejected.
- Authorization is rechecked server-side.
- All layers select the same fallback season.

### Phase 4 — WSM-000239: lifecycle-aware schedule

**Goal:** Turn the schedule into a compact lifecycle timeline and expose the playoff handoff at the correct moment.

**Deliverables**

- Extract schedule grouping and initial-open-state derivation into a pure helper, e.g. `apps/web/src/lib/schedule-weeks.ts`, with unit tests.
- Add client accordion composition under `apps/web/src/components/schedule/ScheduleWeeks.tsx` while retaining server-side data loading in the page.
- Render completed weeks collapsed, future weeks expanded, and mixed weeks with a nested completed subsection.
- Add expand/collapse-all controls with accurate `aria-expanded` behavior.
- Surface `AdvanceToPlayoffsButton` when regular-season completion and role checks permit, and change its action contract to accept and authorize the explicit viewed `seasonId` so a `?season=` context can never mutate a different active season.
- Hide all mutation controls for completed seasons in the server-rendered page.
- Extend `apps/web/e2e/tests/schedules-standings.spec.ts` and `playoffs-bracket.spec.ts`.

**Dependencies:** Phases 2 and 3.  
**Risks:** hydration mismatch from server/client defaults; cancelled fixtures; unscheduled bucket semantics; preserving `?season=` links.

**Acceptance criteria**

- Week defaults and mixed-week nesting match WSM-000239.
- Global accordion controls work by keyboard and pointer.
- Start-playoffs appears only in the ready state for authorized users.
- Completed seasons are read-only in both rendering and backend behavior.

### Phase 5 — WSM-000240: contextual matchup drawer

**Goal:** Inspect a scheduled or final game without leaving schedule or bracket context.

**Deliverables**

- Add a shared `apps/web/src/components/games/GameContextDrawer.tsx` using `ui/sheet.tsx`.
- Define a serializable drawer projection for fixture, teams, result, bracket seeds, venue, and play-log availability; keep fetching in server pages/data API rather than duplicating Gamecast state.
- Convert schedule matchup rows and playoff matchup cards to accessible drawer triggers.
- Preview scheduled games; summarize final games; include “Open full Gamecast” only when a persisted play log exists.
- Preserve direct links to team pages and the full Gamecast route.
- Add component coverage plus schedule/playoff cases in `apps/web/e2e/tests/gamecast.spec.ts` and `playoffs-bracket.spec.ts`.

**Dependencies:** Phase 1.  
**Risks:** interactive elements nested inside a trigger; excessive per-fixture reads; drawer payload growth; mobile overflow.

**Acceptance criteria**

- Scheduled and final games render the correct drawer mode from both surfaces.
- Archived seasons work through `?season=`.
- Full Gamecast remains the canonical detailed experience.
- Focus, Escape, restoration, and 375px overflow checks pass.

### Phase 6 — WSM-000241: round-aware playoff operations

**Goal:** Advance playoffs deliberately and prevent bulk simulation from deciding the championship.

**Deliverables**

- Add pure bracket-round selectors in `apps/web/src/lib/playoffs.ts` or `apps/web/convex/lib/bracket.ts` for current unresolved round and championship detection.
- Refactor `simulateUnplayedPlayoffs` in `apps/web/src/app/dashboard/leagues/[id]/schedule/actions.ts` into bounded operations that accept, resolve, and authorize the explicit viewed `seasonId` rather than falling back to an active season:
  - simulate unfinished games in the current round;
  - simulate rounds only through semifinal;
  - never bulk-simulate an unresolved championship.
- Add explicit round controls to the playoffs page/bracket client composition.
- Restrict redesigned bulk round operations to single elimination. Existing double-elimination brackets remain readable and playable one matchup at a time through their fixture/context action, but “Advance to next round” and bulk “Sim playoffs” are hidden and their server actions reject `unsupported_format`; do not apply shared round-number logic across winners, losers, and grand-final branches.
- Normalize 4/8/16 validation and friendly errors for newly created/upcoming season configuration. Preserve read, simulation, and archived rendering for existing legacy bracket sizes (including 2/6/10/12 and other already persisted supported sizes); do not rewrite legacy records.
- Extend playoff action, bracket unit, and Playwright tests.

**Dependencies:** Phases 2, 3, and 5.  
**Risks:** byes and partially completed rounds; double-elimination compatibility; stale bracket reads after each simulated fixture.

**Acceptance criteria**

- Start playoffs is readiness-gated.
- “Advance to next round” affects only the current round.
- “Sim playoffs” stops with one unresolved championship.
- Championship completion is explicit.
- Unauthorized users cannot mutate brackets.

### Phase 7 — WSM-000242: generation flows and roster auto-fill

**Goal:** Make setup dependencies visible and recoverable without fake progress.

**Deliverables**

- Reuse Phase 2 dialogs in `GenerateScheduleButton`, `SyntheticRosterButton`, attribute generation, and dynasty rollover.
- Add a bounded roster-status projection/query that returns team target, active count, and deficit without unbounded client reads.
- Extend `apps/web/src/app/dashboard/_actions/synthetic-rosters.ts` with authorized team/all-short-team fill operations using the existing roster target and generator.
- Add an undersized-roster warning/dialog listing only deficient teams and displaying operation results.
- Admins may fill all deficient teams; coaches remain constrained by existing team authorization.
- Extend synthetic roster unit/action tests and relevant roster/dynasty E2E fixtures.

**Dependencies:** Phases 2 and 3.  
**Risks:** Convex read/write limits for large leagues; confusing active-player counts with season assignments; coach authorization fan-out.

**Acceptance criteria**

- Generation actions use blocking dialogs with truthful states.
- Only deficient teams are offered for auto-fill.
- Full teams remain unchanged.
- Admin/coach/viewer boundaries are enforced and tested.

### Phase 8 — WSM-000243: completion and explicit dynasty rollover

**Goal:** Present completion and rollover as explicit, consecutive, auditable steps.

**Deliverables**

- Refine season completion controls in `apps/web/src/app/dashboard/seasons/season-actions.tsx` and season hub placement.
- After completion, present a next-step card that launches separately confirmed rollover; do not mutate players during completion.
- Refactor `startNextSeasonAction` and `evaluateStartNextSeason` to resolve the newest eligible **completed** source season when no upcoming season exists. Revalidate that source is decided, belongs to the league, has not already rolled over, and is unambiguous; never reactivate it.
- Refactor the action response into a typed operation summary for source season, graduation, advancement, progression, carryover, recruiting, and target season.
- Use the process dialog to show pending state and then truthful completed-step counts from that response.
- Link success to `/dashboard/seasons/[newSeasonId]` and its `OffseasonHub`.
- Add `seasonRollovers` schema/indexes and transactional begin/resume/finalize mutations. Record source→target lineage and stable stage progress so partial failures can resume safely.
- Add state-transition tests for complete → rollover-from-completed → upcoming activation, direct rollover-before-completion rejection, retry during each persisted stage, retry after target activation, and concurrent begin attempts.
- Refactor the server action to resume an in-progress rollover and return the existing target for completed operations; never treat an unqualified `next_season_exists` check as sufficient idempotency.
- Extend `apps/web/convex/__tests__/dynastyRollover.test.ts`, dashboard dynasty action tests, and `apps/web/e2e/tests/dynasty.spec.ts`.

**Dependencies:** Phases 2, 3, and 7.  
**Risks:** current rollover spans multiple mutations; forced completion semantics; duplicate upcoming season after a partial failure.

**Acceptance criteria**

- Completion and rollover remain separate actions.
- Rollover summaries match persisted outcomes.
- Success routes to the new upcoming season.
- Retries do not create duplicate upcoming seasons.
- Historical graduates and season data remain readable.

### Phase 9 — WSM-000244: approved preferences and simulation settings

**Goal:** Persist presentation preferences locally and competition rules on the season.

**Deliverables**

- Keep `next-themes` as the theme authority; add a density provider/control using a stable localStorage key and an app-root `data-density` attribute.
- Apply compact density through token/utility adjustments, not per-page one-off styling.
- Add `simulationFlavor: "chalk" | "balanced" | "upsets"` to the season schema, validators, DTO/data API projection, create/edit actions, and season form.
- Thread simulation flavor into `simulateAndPersistFixture`/PBP simulation weighting while retaining deterministic results for a fixed fixture, flavor, and seed.
- Restrict new/upcoming playoff size updates to 4/8/16 and reject changes after bracket creation. Existing seasons with legacy sizes remain renderable and operable but cannot be silently normalized.
- Do not add an accent-color control; preserve monochrome/status-only app styling.
- Add migration/backward-default handling (`balanced`) and schema/action/simulation/UI tests.

**Likely files**

- `apps/web/convex/schema.ts`
- `apps/web/convex/sports.ts`
- `apps/web/src/lib/data-api.ts`
- shared season DTO types if required
- `apps/web/src/app/dashboard/seasons/actions.ts`
- `apps/web/src/app/dashboard/seasons/season-actions.tsx`
- `apps/web/src/lib/simulate-fixture.ts`
- `apps/web/src/lib/pbp/engine.ts` or a narrower simulation weighting helper
- new density provider/control components

**Dependencies:** Phase 1; Phase 3 for settings locks.  
**Risks:** simulation balance changes; backward compatibility for existing season records; theme hydration flash.

**Acceptance criteria**

- Theme and density persist at device scope without first-paint mismatch.
- Simulation flavor persists at season scope and changes deterministic weighting.
- Bracket size locks after bracket creation.
- Accent customization remains absent.

### Phase 10 — Integration, review, and shipping

**Goal:** Verify the complete lifecycle and ship each dependency-safe PR.

**Deliverables**

- Run focused tests in every child PR, then the aggregate suite:
  - `pnpm --filter @sports-management/web type-check`
  - `pnpm --filter @sports-management/web lint`
  - `pnpm --filter @sports-management/web test:unit`
  - relevant Playwright specs via `pnpm --filter @sports-management/web test:e2e -- <specs> --project=chromium`
  - `pnpm --filter @sports-management/web test:visual`
- Run the full lifecycle from regular-season finish through upcoming-season offseason with deterministic E2E seed data.
- Independently review lifecycle authorization, completed-season immutability, rollover idempotency, accessibility, and responsive behavior.
- Link each PR with `Closes #<child issue>` and update epic #523.
- After all child issues are merged, close #523 and move this plan/progress pair to `docs/archive/`.

**Dependencies:** Phases 1–9.  
**Risks:** long-lived visual snapshots; branch conflicts in schedule/playoff pages; cross-story E2E fixture drift.

**Acceptance criteria**

- All child acceptance criteria pass.
- Existing league, season, Gamecast, and offseason regression suites remain green.
- No prototype runtime or localStorage domain data enters production.

## 5. Test strategy

### Unit and component tests

- Lifecycle dialog behavior, focus, pending state, errors, and operation summaries.
- Schedule week classification/default state.
- Season transition guards and fallback selection.
- Current playoff round, semifinal stop, byes, partial rounds, and legacy non-4/8/16 bracket readability.
- Roster deficits and authorized fill scope.
- Dynasty result summaries and idempotency.
- Simulation flavor determinism and weighting.

### Convex and server-action tests

- Completed-season mutation rejection for every write path.
- Role checks for lifecycle, playoff, and roster-fill actions.
- Season schema/default compatibility.
- Playoff generation and round progression.
- Dynasty persistence and retry behavior.

### E2E and visual tests

- One deterministic lifecycle: finish regular season → start playoffs → advance/sim through semifinal → explicitly play championship → complete season → confirm rollover → arrive at upcoming offseason.
- Schedule accordion states and mixed weeks.
- Preview/final drawers from schedule and bracket.
- Archived-season read-only behavior.
- Keyboard/focus behavior, reduced motion, and 375px page-overflow checks.
- Dark/light plus comfortable/compact visual baselines.

### Manual QA

- Compare production routes side-by-side with the prototype at desktop and mobile widths.
- Confirm unsupported prototype controls are absent.
- Confirm all progress logs correspond to actual completed server outcomes rather than timers.
- Exercise browser Back separately from “Back to League.”

## 6. Acceptance criteria mapping

| Epic criterion | Phases | Verification |
| --- | --- | --- |
| Recreate the approved lifecycle using production foundations | 1–9 | Child issue tests plus deterministic lifecycle E2E |
| Existing season archive, Gamecast, league management, and offseason remain available | 1, 5, 8, 10 | Existing unit/E2E suites and final regression run |
| No prototype localStorage domain data, accent controls, or inert controls enter production | 1, 9, 10 | Code review, visual tests, and UI assertions |

Each child issue's criteria are mapped to its same-numbered phase above and must be verified before that child PR is accepted.

## 7. Risks and notes

- **Completion/rollover state:** completion removes the active season, while the current rollover action requires one. Implement newest-eligible-completed source resolution plus persisted source→target rollover lineage; do not reactivate the completed season.
- **Rollover atomicity:** the current server action orchestrates multiple mutations. Use a transactional source claim/target creation and resumable persisted stages so retries and concurrent starts converge on one target.
- **Existing bracket compatibility:** retain readable existing double-elimination and legacy-size brackets; double-elimination remains playable per matchup but has no bulk round controls. Do not silently corrupt or reinterpret it while new bulk controls/configuration target single elimination and 4/8/16.
- **Authorization terminology:** current schedule/playoff actions permit `canManageRoster` roles. WSM-000238 must settle and consistently enforce the approved admin/manager policy without relying on hidden buttons.
- **Progress truthfulness:** no fake timers or percentages. Show pending work and server-confirmed completed steps.
- **Performance:** avoid a query per matchup in the drawer and avoid unbounded roster counts; build bounded projections.
- **Working tree:** the prototype directory was untracked at planning time. Do not accidentally include unrelated handoff changes in implementation commits unless explicitly intended.

## 8. Out of scope and deferred

- Porting prototype React/Babel/localStorage runtime into production.
- Arbitrary accent-color customization.
- Replacing the full Gamecast page or its simulation/review engine.
- A redesign of free-agency/draft semantics; that remains a separate follow-up unless a blocking lifecycle defect is found.
- New league creation, member management, public visibility, search, Go Live, or other prototype stubs beyond existing production capabilities.
- Removing historical double-elimination data support.
- Automatic rollover immediately on season completion.

## 9. Immediate next steps

1. Approve this implementation plan on epic #523.
2. Implement dependency-safe child issues in order: 236 → 237/238 → 239/240 → 241/242 → 243/244.
3. Use one branch and PR per child issue; parallelize only branches without file/dependency conflicts.
4. Update `docs/WSM-000235-progress.txt` as each child PR advances.
5. Run independent review before accepting each mutation-heavy phase.

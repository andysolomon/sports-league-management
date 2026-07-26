# Offseason: Free Agents + Optional Draft

Status: **SHIPPED** (2026-07-25). Built on top of the dynasty rollover
(docs/design/dynasty-mode.md). All four phases (O1–O4) landed; the "Open questions
for sign-off" below are resolved and recorded against the shipped behavior.

Extended by `docs/design/offseason-pipeline.md`, which turns this fixed
Rollover → Draft → Free agency → Activate sequence into a persisted, multi-phase
offseason machine (scouting, transfers, promotions, training). The free-agency and
draft mechanics described here are **reused, not replaced**.

As built:

- `drafts` + `draftPicks` tables — `apps/web/convex/schema.ts:496,511`
- `startDraft` / `makeDraftPick` / `endDraft` — `apps/web/convex/sports.ts:5300,5358,5451`
- `releasePlayerToFreeAgency` / `signFreeAgent` / `listFreeAgents` — `sports.ts:5050,5086,5163`
- Pick-order helper — `apps/web/convex/lib/draft.ts`; roster-size helper — `convex/lib/offseason.ts`
- UI — `apps/web/src/components/offseason/` (OffseasonHub, OffseasonPhaseStepper,
  DraftBoard, DraftStartToggle, FreeAgencyPanel, FreeAgencyTableView,
  ReleasePlayerButton, ActivateSeasonWarningDialog)
- Server actions — `apps/web/src/app/dashboard/_actions/{offseason,draft}.ts`
- e2e — `apps/web/e2e/tests/offseason-{draft,free-agency}.spec.ts`

## Context

dynasty-mode.md defines the offseason as the `upcoming`-season window: rollover
creates the next season as `upcoming`, graduates seniors, advances grades, generates
a freshman class; activating the season starts the year. There is no player movement
phase — rosters carry over as-is (plus freshmen). This slice adds two movement
mechanisms — a free-agent pool and an optional draft — sequenced inside that
existing window. No new season states are introduced.

## Offseason hub

**Where:** the season detail page (`/dashboard/seasons/[id]`) when that season's
status is `upcoming` — the page already hosts the DynastyPanel (WSM-000227), making
it the natural offseason home. The hub is a phase stepper card above the panel:

```
Rollover ✓ → Draft (optional) → Free agency → Activate season
```

- **Rollover** — already done by definition (an `upcoming` season exists). Shows the
  rollover summary counts.
- **Draft** — present only if the admin enabled the draft when entering the
  offseason (toggle on the hub while the pool is untouched). Skippable.
- **Free agency** — open from draft completion (or immediately if no draft) until
  the season is activated.
- **Activate** — existing `setActiveSeason`; closes the offseason. Guard: warn (not
  block) when rosters are below target size.

Phase state is derived, not stored, wherever possible (see Data). The stepper is a
DS-pattern segmented progress header; each phase is a card section on the same page.

## Free-agent pool

**What feeds it** (all league-scoped, computed per offseason):

1. Players with `teamId` unset/cleared ("cut" — a new Release action on the roster
   surface, admin/coach of that team only).
2. Generated players never attached to a team (today's generator always assigns a
   team; a pool-targeted generation option can top the pool when it runs dry —
   admin action, reuses the synthetic generator with `teamId: null`).
3. NOT in the pool: graduated players (status `graduated` stays terminal).

**Model:** free agency = `players.teamId === null` + `status === "active"`. No new
table; the pool is a query (`players.by_leagueId` filtered client-of-index). This
matches the synthetic-league membership model (players.teamId is the source of
truth — WSM-000218 fix) and works for assignment-backed leagues by also writing the
`rosterAssignment` on signing, mirroring `assignPlayerToRoster`.

**Signing flow:** pool table (filters: position, grade, overall range; sort by
overall/name) → "Sign" per row → team picker (admin) or fixed own team (coach) →
sets `teamId`, writes assignment + default depth-chart slot via the existing
`assignPlayerToRoster` path. Cap: signing blocked when the team is at target roster
size (same constant the generator tops to). All writes `internalMutation` behind an
admin/coach-gated server action.

## Optional draft

**Toggle:** on the hub, admin-only, only before any pick is made. Draft type:
**snake** (round order reverses each round) — simplest defensible default; linear
noted as a config field but not built in v1.

**Order:** reverse final standings of the just-completed season (existing standings
math), ties broken by point differential then coin-flip seeded by seasonId
(deterministic).

**Pool:** the free-agent pool at draft start (see above), typically the freshman
class if the admin generates freshmen into the pool instead of auto-assigning.
This adds one option to the rollover: "Freshmen: auto-assign to teams (default) |
send to draft pool". Default preserves current behavior exactly.

**Board:** three-pane DS layout — available players table (same filters as FA),
team-on-the-clock banner with pick number, pick history list. Making a pick =
the signing flow with the team forced to the on-the-clock team. No timer; picks
are manual (admin can pick for absent coaches). Draft ends when rounds are
exhausted (rounds = ceil(pool / teams), capped small, e.g. 3) or admin ends it;
remaining players stay in free agency.

## Data / backend

New Convex state (all writes `internalMutation`, admin-gated server actions):

- `drafts` (one per league+season): `{ leagueId, seasonId, type: "snake", rounds,
  order: teamId[], status: "pending"|"active"|"complete", currentPick }`
- `draftPicks`: `{ draftId, round, pickNumber, teamId, playerId, madeAt }` —
  append-only history.
- `players.teamId` becomes clearable (Release action) — no schema change needed if
  already optional (verify; else `v.optional`).
- No changes to seasons, fixtures, standings, or the rollover mutations. Phase
  derivation: draft exists+incomplete → Draft phase; else upcoming season → FA.

Invariants: idempotent pick-making (pick number uniqueness), no writes after
`setActiveSeason` (hub hides; server actions re-check season status), graduated
players never enter the pool.

## UI summary

DS/app-token components only: phase stepper (segmented header), FA table +
filters (Table, Input, Select, Badge), draft board (Table + Card + Badge),
Release/Sign/Pick buttons with confirm dialogs. Mobile: single column, board
panes stack.

## Phase breakdown (proposed)

- **O1** Backend: pool query + release/sign actions + tests (FA only, no draft)
- **O2** UI: offseason hub stepper + FA table + sign flow + e2e
- **O3** Backend: drafts/draftPicks + order derivation + pick action + freshman
  pool-routing option + tests
- **O4** UI: draft board + toggle + e2e; activate-season guard copy

Each phase is one PR through the standard pipeline. O1+O2 deliver user value
without the draft; O3+O4 are cleanly additive.

## Open questions — resolved as built

1. **Roster cap on signing: soft, not hard.** `signFreeAgent` (`sports.ts:5086`)
   computes `overCap = activeCount >= targetRosterSize()` and returns it to the
   caller, but signs anyway — it passes `enforceRosterLimit: false` to
   `assignPlayerToRosterCore`. The UI warns; nothing blocks. Real HS rosters vary.
   Target is 48, clamped to 60 (`convex/lib/offseason.ts`).
2. **Coaches may release and sign for their own team.** The offseason is *not*
   admin-only. `canAdminOrManageTeam` (`_actions/offseason.ts:18`) grants access to
   an org admin **or** anyone `canManageTeam(teamId, userId)` — i.e. a coach scoped
   to that team, resolved through `resolveTeamRole` across both the league org and a
   forking org (WSM-000121). This per-`teamId` gate is the precedent
   `offseason-pipeline.md` follows for every new per-team offseason action, and it is
   what keeps multi-coach online dynasty open without a rewrite.
3. **Draft rounds are a fixed 3**, not `ceil(pool/teams)` — `DRAFT_ROUNDS = 3`
   (`sports.ts:5202`). Undrafted players remain in free agency.
4. **"Send freshmen to draft pool" is not remembered.** It is a per-invocation
   `freshmenToPool?: boolean` argument on `startNextSeasonAction`
   (`_actions/dynasty.ts:151`), defaulting to `false` (auto-assign to teams), which
   preserves the pre-draft behavior exactly. Per-league persistence of this and other
   knobs is picked up by the `dynastyConfig` table in
   `docs/design/dynasty-foundations.md`.

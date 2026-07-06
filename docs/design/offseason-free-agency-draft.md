# Offseason: Free Agents + Optional Draft

Status: DRAFT for review (2026-07-06). Net-new feature slice on top of the dynasty
rollover (docs/design/dynasty-mode.md). Nothing here is built; no code ships until
this doc is signed off.

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

## Open questions for sign-off

1. Roster cap on signing: hard block at target size, or allow overflow with a
   warning (real HS rosters vary)?
2. Coach permissions: may coaches release/sign for their own team during FA, or is
   the whole offseason admin-only in v1?
3. Draft rounds: fixed small number (3?) or `ceil(pool/teams)` uncapped?
4. Should "send freshmen to draft pool" be remembered per league as the default for
   future offseasons?

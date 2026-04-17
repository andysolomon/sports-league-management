# Roster Management

> **Status:** Design / pre-implementation. No code has shipped yet. This document is the source of truth until issues are cut.
> **Audience:** Human contributors AND AI coding agents arriving cold. Every file path, table name, field name, flag name, and route path referenced below is authoritative — use it verbatim.

---

## TL;DR (read this first)

We are adding **roster management** on top of the existing League / Division / Team / Player / Season model. Scope is American-football-first, Football-Manager-lite in depth: season-locked roster snapshots, depth charts, optional PFF+Madden-weighted player attributes, manual schedules, computed standings, and a full audit log. Ships behind Vercel Flags in three phases. Existing ESPN NFL sync is extended to populate rosters and attributes. Two personas: League Admin (broad control) and Team Manager/Coach (own team only). Auth reuses `authorizeTeamMutation` in `apps/web/src/lib/authorization.ts`.

**If you are an AI agent starting here, read sections 2, 4, 5, and 7 in that order before touching code.**

---

## 1. Overview

### Problem
Players in the current schema (`apps/web/convex/schema.ts:37`) attach directly to a single `teamId` with no season context. There is no concept of a depth chart, no player attributes/ratings, no schedule, no standings, and no audit trail for roster changes. This blocks real-world usage by NFL-style leagues where rosters evolve week-to-week and historical season data matters.

### Outcome
After v1 ships:
- Admins can build per-season rosters, enforce size limits, and see an audit log of every change.
- Coaches/managers can edit their own team's depth chart per position.
- Players can carry optional attribute ratings sourced from PFF and Madden with a weighted overall.
- Admins can enter fixtures manually and the system computes standings from entered results.
- Season-over-season rating deltas are queryable per player.

### Non-goals (v1)
- Formation visualization (depth chart is ordered lists only).
- Tactical simulation.
- Auto-generated schedules.
- Configurable eligibility rule engine (we only enforce roster size + status flags).
- Game-level player stat entry (the data model leaves a hook for v2; UI is not built).

---

## 2. Research Summary

### Football Manager takeaways (applied)
- **Squad depth categories** → our status flags (Active, IR, Suspended, Released) plus depth chart rank.
- **Role-based player attributes** → position-group attribute schemas (QB, RB, WR, TE, OL, DL, LB, DB, K/P).
- **Development arcs** → season-over-season attribute delta view.

### FM takeaways (deferred)
- Formation/tactical board (depth chart only in v1).
- Training & mentoring systems.
- Player personality/morale.

### Madden / PFF rating model
Each player's attributes are the **weighted average** of matched PFF and Madden source values. Default weight is 50/50, configurable per sync run. Both sources may be null — an attribute is only populated when at least one source has a value.

### Real-world platform patterns adopted
- **Season-locked rosters** (TeamSnap/SportsEngine pattern): historical rosters never mutate after a season closes; edits create new snapshots.
- **Basic eligibility**: roster size + status flags, not a configurable rule engine.
- **Manual schedule entry**: universal lowest-common-denominator; auto-generation comes later.

### Research Bucket A — Football Manager (simulation / depth)

| Theme | Description | sprtsmng relevance |
|-------|-------------|-------------------|
| Squad depth / coverage | Position matrix; gaps ("no natural LB"); two-deep planning | **FM-leaning** — needs position taxonomy, optional secondary positions, depth ordering per `(team, season)` |
| Squad planner / assistant | "Best XI", weak spots, tactic fit | **FM-leaning** — needs ratings or rules (coach 1–5 stars or PFF/Madden feed) |
| Saved selections / lineups | Named squads (Cup / League / Youth) with different XIs | **FM-leaning** — deferred past v1 |
| Squad hierarchy / roles | Starters vs rotation vs prospects | **Both** — partially satisfied by `rosterAssignments.status` + `depthRank` |
| Squad comparison | vs league or rival team | **FM-leaning** — deferred; analytics layer |
| Development / loans / minutes | Long-horizon career sim | **FM-leaning** — out of scope; only attribute deltas covered (§5.3) |

Companion pattern: third-party FM helpers emphasize **exportable depth views** and **clear positional signals** — a lighter path than full FM is "depth chart + CSV" before simulation.

### Research Bucket B — League / team SaaS (operations)

Reference platforms: **TeamSnap**, **LeagueApps**, **SportsEngine**.

| Theme | Description | sprtsmng relevance |
|-------|-------------|-------------------|
| Roster lifecycle | Registration → assign team → lock roster → waivers / add-drop windows | **Ops-leaning** — partially covered: roster assignments + season-locked snapshots (§5.1) |
| Compliance | Waivers, medical flags, age verification, documents | **Ops-leaning** — out of scope for v1 |
| Role-based access | Coach vs admin vs read-only parent | **Ops-leaning** — aligns with Clerk org roles (§3) |
| Comms + scheduling | Eligibility tied to events | **Ops-leaning** — schedules land in §5.4; comms deferred |

### Feature Matrix — tagging and phase ownership

| # | Feature | Tag | Phase (§5) | Flag |
|---|---------|-----|------------|------|
| 1 | Depth chart by position slot | **Both** | §5.2 | `depth_chart_v1` |
| 2 | Season-scoped roster snapshots | **Ops-leaning** | §5.1 | `roster_snapshots_v1` |
| 3 | Secondary / eligible positions | **FM-leaning** | Deferred (v2) | — |
| 4 | Named lineups / saved XI | **FM-leaning** | Deferred (v2) | — |
| 5 | Roster rules engine (caps beyond `rosterLimit`, IR/PUP) | **Ops-leaning** | §5.1 (size only) | `roster_snapshots_v1` |
| 6 | Import/export parity (CSV depth chart) | **Both** | §6 (adjacent) | phase-gated |
| 7 | Player notes / coach ratings (org-private) | **FM-leaning** | Deferred (v2) | — |
| 8 | Player attributes + development | **FM-leaning** | §5.3 | `player_attributes_v1` |
| 9 | Fixtures + standings | **Ops-leaning** | §5.4 | `schedules_standings_v1` |
| 10 | Audit log | **Both** | §5.5 | `roster_snapshots_v1` |

---

## 2.1 Grill-me resolutions

These are the scope-narrowing questions that drove the §5 phase breakdown. Each row states the **working assumption** in force until the Decision log (§11.1) records an override.

| # | Question | Working assumption | Binds to |
|---|----------|-------------------|----------|
| Q1 | North star: FM depth vs league ops vs hybrid? | **Hybrid** — ship depth chart + season roster + audit log first (Phase 1); attributes and standings follow | §5.1 + §5.2 + §5.5, flags `roster_snapshots_v1`, `depth_chart_v1` |
| Q2 | Audience: who edits and who reads? | Both **League Admin** and **Team Manager/Coach** edit within scope; Admin==Coach Clerk role in v1; Viewers read | §3 Personas & Permissions |
| Q3 | Sport scope: football-only vs generic slots? | **American-football-first** with canonical `positionSlot` taxonomy; generic slots are a post-v1 concern | §4.5 Position group taxonomy |
| Q4 | Season binding: global roster vs per-season? | **Per `(team, season)`** via `rosterAssignments`; `players` identity stays global | §4.1 `rosterAssignments` table |
| Q5 | Write frequency: daily churn vs set-at-draft? | **Moderate churn** — every mutation writes to `rosterAuditLog` in the same txn; no formal undo UI in v1 | §5.5 Audit Log |
| Q6 | Public vs private depth chart? | **Dashboard-authenticated users only** in v1; public parent view is v2 behind a flag + league policy | §3 Viewer persona, §8 Feature Flags |
| Q7 | v1 must-have (single differentiator)? | **Depth chart + season edit lock** — if forced to cut, Phase 0 ships that slice alone (see §10) | §10 Rollout Plan (Phase 0) |

---

## 3. Personas & Permissions

| Persona | Scope | Key capabilities |
|--------|-------|------------------|
| **League Admin** | Everything inside their league | Roster imports, season creation, eligibility (roster size), fixtures, result entry, standings view, audit log, attribute ingestion config |
| **Team Manager / Coach** | Their own team within a league | Edit own team's depth chart, update player status flags on own roster, view own audit entries, view public league data |
| **Viewer** (public league subscriber) | Read-only | View rosters, depth charts, standings, schedules |

### Authorization anchors
- League Admin = user has `org:admin` role in the Clerk org that owns the league. Checked via `authorizeLeagueMutation` (new — mirror of existing `authorizeTeamMutation` in `apps/web/src/lib/authorization.ts`).
- Team Manager = user has `org:admin` on the league's owning org **and** is assigned as manager on the team (existing pattern in `authorizeTeamMutation`). v1 treats "Team Manager" and "League Admin" as the same Clerk role; per-team manager assignment is a v2 concern.
- Visibility is gated by `resolveOrgContext(userId)` in `apps/web/src/lib/org-context.ts` — do not introduce a parallel visibility path.

---

## 4. Data Model

### 4.1 New Convex tables

Add to `apps/web/convex/schema.ts`:

```ts
rosterAssignments: defineTable({
  seasonId: v.id("seasons"),
  teamId: v.id("teams"),
  playerId: v.id("players"),
  leagueId: v.id("leagues"),
  depthRank: v.number(),            // 1 = starter, 2 = backup, etc.
  positionSlot: v.string(),         // e.g. "QB", "LT", "SS" — canonical position string
  status: v.string(),               // "active" | "ir" | "suspended" | "released"
  assignedAt: v.string(),
  assignedBy: v.string(),           // userId
})
  .index("by_seasonId_teamId", ["seasonId", "teamId"])
  .index("by_seasonId_teamId_position", ["seasonId", "teamId", "positionSlot"])
  .index("by_playerId", ["playerId"])
  .index("by_leagueId_seasonId", ["leagueId", "seasonId"]);

playerAttributes: defineTable({
  playerId: v.id("players"),
  seasonId: v.id("seasons"),
  positionGroup: v.string(),        // "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "DB" | "K/P"
  attributesJson: v.string(),       // { armStrength: 88, accuracy: 91, ... }
  pffSourceJson: v.union(v.string(), v.null()),
  maddenSourceJson: v.union(v.string(), v.null()),
  pffWeight: v.number(),            // 0..1, default 0.5
  maddenWeight: v.number(),         // 0..1, default 0.5
  weightedOverall: v.union(v.number(), v.null()),
  ingestedAt: v.string(),
})
  .index("by_playerId_seasonId", ["playerId", "seasonId"])
  .index("by_seasonId_positionGroup", ["seasonId", "positionGroup"]);

rosterAuditLog: defineTable({
  leagueId: v.id("leagues"),
  teamId: v.id("teams"),
  seasonId: v.id("seasons"),
  actorUserId: v.string(),
  action: v.string(),               // "assign" | "remove" | "status_change" | "depth_reorder" | "bulk_import"
  beforeJson: v.union(v.string(), v.null()),
  afterJson: v.union(v.string(), v.null()),
  createdAt: v.string(),
})
  .index("by_leagueId_createdAt", ["leagueId", "createdAt"])
  .index("by_teamId_createdAt", ["teamId", "createdAt"]);

fixtures: defineTable({
  seasonId: v.id("seasons"),
  leagueId: v.id("leagues"),
  homeTeamId: v.id("teams"),
  awayTeamId: v.id("teams"),
  scheduledAt: v.string(),
  week: v.union(v.number(), v.null()),
  venue: v.union(v.string(), v.null()),
  status: v.string(),               // "scheduled" | "in_progress" | "final" | "canceled"
})
  .index("by_seasonId", ["seasonId"])
  .index("by_seasonId_week", ["seasonId", "week"])
  .index("by_homeTeamId", ["homeTeamId"])
  .index("by_awayTeamId", ["awayTeamId"]);

gameResults: defineTable({
  fixtureId: v.id("fixtures"),
  homeScore: v.number(),
  awayScore: v.number(),
  status: v.string(),               // "final" | "forfeit" | "disputed"
  playerStatsJson: v.union(v.string(), v.null()),  // v2 extension hook; v1 leaves null
  recordedAt: v.string(),
  recordedBy: v.string(),
})
  .index("by_fixtureId", ["fixtureId"]);
```

### 4.2 Extensions to existing tables

```ts
// teams: add
rosterLimit: v.union(v.number(), v.null()),   // default 53 for NFL, null = no limit
// players: add
positionGroup: v.union(v.string(), v.null()), // derived; nullable for non-football
```

### 4.3 Salesforce mirror

Objects to add under `sportsmgmt-football/main/default/objects/`:
- `RosterAssignment__c` — mirrors `rosterAssignments`
- `PlayerAttribute__c` — mirrors `playerAttributes`
- `Fixture__c` — mirrors `fixtures`
- `GameResult__c` — mirrors `gameResults`

`rosterAuditLog` stays in Convex only (volume + not business-critical in SF).

Sync direction: Convex is primary; Salesforce is eventual-consistent via the existing jsforce bridge in `apps/web/src/lib/salesforce-api.ts`. Phase 1 can ship Convex-only and add Salesforce mirror in a follow-up.

### 4.4 Shared types

Add to `packages/shared-types/src/index.ts`:

```ts
export interface RosterAssignmentDto { /* mirror table shape with string ids */ }
export interface PlayerAttributeDto { /* ... with parsed attributes object */ }
export interface RosterAuditLogDto { /* ... */ }
export interface FixtureDto { /* ... */ }
export interface GameResultDto {
  id: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  status: string;
  playerStats: PlayerGameStats[] | null;  // v2 hook, always null in v1
  recordedAt: string;
  recordedBy: string;
}
export interface PlayerGameStats { /* extensible; no fields required in v1 */ }
```

Add matching Zod schemas to `packages/api-contracts/src/`.

### 4.5 Position group taxonomy (American Football)

| Group | Positions |
|-------|-----------|
| QB | QB |
| RB | HB, FB |
| WR | WR |
| TE | TE |
| OL | LT, LG, C, RG, RT |
| DL | DE, DT, NT |
| LB | OLB, MLB, ILB |
| DB | CB, S, FS, SS, NB |
| K/P | K, P, LS |

Position group is derivable from `players.position`; cached into `players.positionGroup` on write.

### 4.6 Default attribute schemas per position group

Stored as JSON in `playerAttributes.attributesJson`. Initial v1 set (expand later):

- **QB**: armStrength, accuracy, pocketAwareness, mobility, decisionMaking
- **RB**: speed, vision, elusiveness, breakTackle, receiving
- **WR**: speed, routeRunning, catching, separation, afterCatch
- **TE**: blocking, routeRunning, catching, strength
- **OL**: passBlock, runBlock, strength, awareness
- **DL**: passRush, runStop, strength, awareness
- **LB**: coverage, tackling, passRush, awareness
- **DB**: speed, coverage, ballSkills, tackling
- **K/P**: power, accuracy, consistency

All 0–99 scale (Madden convention).

---

## 5. Features

### 5.1 Season Rosters (Phase 1 — flag `roster_snapshots_v1`)

**Who:** Admin creates; Admin + Coach edit within their scope.

**What:**
- Assign/remove players on a team for a given season → writes to `rosterAssignments`.
- Status flag updates (`active` / `ir` / `suspended` / `released`).
- Enforce `teams.rosterLimit` on assignment (default 53). Over-limit assignments are rejected with an error; admins can raise the limit per team.
- Roster history: list all `rosterAssignments` for a `playerId` ordered by season to see a player's team history.

**Convex functions to add** in `apps/web/convex/sports.ts`:
- `assignPlayerToRoster`, `removePlayerFromRoster`, `updateRosterStatus`
- `listRosterForTeamSeason`, `listPlayerRosterHistory`

### 5.2 Depth Chart (Phase 1 — flag `depth_chart_v1`)

**Who:** Coach (own team); Admin (any team).

**What:**
- Per team, per season, per `positionSlot`: ordered list of players by `depthRank`.
- Drag-to-reorder UI using `@dnd-kit/core` + `@dnd-kit/sortable` (add to `apps/web/package.json`).
- Renders as 1st string / 2nd string / 3rd string labels.
- Validation: a player must have an `active` `rosterAssignments` row for the same (seasonId, teamId) before they can be placed on the depth chart.

**Convex functions:**
- `setDepthChartOrder(teamId, seasonId, positionSlot, playerIdsInOrder[])`
- `getDepthChart(teamId, seasonId)` — returns map of positionSlot → ordered player list

### 5.3 Player Attributes & Development (Phase 2 — flag `player_attributes_v1`)

**Who:** Populated by sync; viewable by everyone with league visibility.

**What:**
- `playerAttributes` rows written per player per season by the sync job.
- Weighted overall computed at ingestion time:
  ```
  overall = (pffOverall * pffWeight + maddenOverall * maddenWeight) / (pffWeight + maddenWeight)
  ```
  where per-attribute values follow the same formula; nulls short-circuit to the available source.
- Development view: given a `playerId`, query all `playerAttributes` rows ordered by season, render line chart of overall + top attributes.

**UI:** `/dashboard/players/[id]/development` — uses `recharts` (already a transitive dep of shadcn) or bring in explicitly.

**Convex functions:**
- `ingestPlayerAttributes(playerId, seasonId, pffSource, maddenSource, weights)`
- `getPlayerDevelopment(playerId)` — returns attribute snapshots ordered by season with deltas

### 5.4 Schedules & Standings (Phase 3 — flag `schedules_standings_v1`)

**Who:** Admin manages fixtures + results; everyone views.

**What:**
- Admin creates `fixtures` manually (one-at-a-time form + CSV upload).
- Admin enters results → writes `gameResults` row, updates `fixtures.status = "final"`.
- Standings are computed on read: aggregate `gameResults` per team within a season → W/L/T, points, divisional standings.
- **Tiebreaker rules** for v1: head-to-head, then division record, then points differential. Configurable later.

**Standings interface (extensible):**

```ts
export interface Standing {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  divisionRank: number;
  leagueRank: number;
  // v2: extended player stat rollups plug in here
  extended?: Record<string, unknown>;
}
```

**Convex functions:**
- `createFixture`, `updateFixture`, `recordGameResult`
- `computeStandings(seasonId)` — returns `Standing[]`
- `computeDivisionStandings(divisionId, seasonId)`

### 5.5 Audit Log (Phase 1)

Every mutation in sections 5.1 and 5.2 writes a `rosterAuditLog` row in the same Convex transaction. Admin-only view at `/dashboard/leagues/[id]/audit` with filters by team, actor, action, date range.

---

## 6. Integrations

### 6.1 ESPN NFL sync extension
- **File to extend:** `apps/web/src/lib/adapters/espn-nfl.ts`
- **Cron trigger:** `apps/web/src/app/api/cron/nfl-sync/route.ts`
- **New responsibilities:**
  1. For each synced team, upsert a `rosterAssignments` row for the current season with status derived from ESPN roster status.
  2. Upsert `playerAttributes` using merged PFF + Madden source payloads.
  3. Populate `players.positionGroup` from the position taxonomy (§4.5).
- **Config:** extend `syncConfigs` key `nfl` with `{ pffWeight: number, maddenWeight: number, currentSeasonId: string | null }`.

### 6.2 PFF / Madden source data
- v1 accepts JSON payloads uploaded by an admin (no scraper, no paid feed integration yet).
- Upload endpoint: `POST /api/import/attributes` — validated by Zod schema in `packages/api-contracts/src/attribute-import-schema.ts`.
- Open question (§11): licensed feed vs. crowdsourced ratings.

### 6.3 Clerk + Stripe
- All mutations authorize through `apps/web/src/lib/authorization.ts` (extend, do not replace).
- Tier gating (open question): attributes + audit log may require `club` or `league` tier via existing `getUserTier()` in `authorization.ts`.

---

## 7. UI Surfaces

All routes live under `apps/web/src/app/` following App Router conventions.

| Route | Who | Purpose |
|-------|-----|---------|
| `/dashboard/teams/[id]/roster` | Admin + Coach | Season roster editor |
| `/dashboard/teams/[id]/depth-chart` | Admin + Coach | Depth chart drag-to-reorder |
| `/dashboard/players/[id]/development` | Everyone | Season-over-season rating chart |
| `/dashboard/leagues/[id]/schedule` | Admin edits; everyone views | Fixture list + create form |
| `/dashboard/leagues/[id]/standings` | Everyone | Computed standings table |
| `/dashboard/leagues/[id]/audit` | Admin only | Roster audit log |

### Component conventions
- Use shadcn primitives already in `apps/web/src/components/ui/`.
- New domain components go under `apps/web/src/components/roster/`, `components/depth-chart/`, `components/schedule/`, `components/standings/`.
- API routes under `apps/web/src/app/api/roster/`, `api/depth-chart/`, `api/fixtures/`, `api/standings/`, `api/audit/`.

---

## 8. Feature Flags

Defined via Vercel Flags SDK (`@vercel/flags`). Add to `apps/web/src/lib/flags.ts` (new file).

| Flag | Gates | Default (dev) | Default (prod) |
|------|-------|---------------|----------------|
| `roster_snapshots_v1` | §5.1 routes, mutations, and nav entry | on | off |
| `depth_chart_v1` | §5.2 routes + mutations | on | off |
| `player_attributes_v1` | §5.3 routes + sync attribute ingestion | off | off |
| `schedules_standings_v1` | §5.4 routes + mutations | off | off |

Flag checks happen at page-level (redirect to 404 if off) and in API routes (403 if off).

---

## 9. Testing

### Vitest (colocated `__tests__` folders)
- `rosterAssignments` mutations: eligibility (roster limit enforcement), status transitions, audit log side effects.
- Depth chart reorder: rank integrity, active-status validation.
- Attribute weighting math: PFF-only, Madden-only, both, weight normalization.
- Standings computation: W/L/T math, tiebreaker ordering, division vs league ranks.
- Authorization: coach cannot mutate another team's roster; admin can mutate any team in their league.

### Playwright E2E (`e2e/`)
Two critical flows only:

1. **`e2e/roster-import.spec.ts`** — Admin triggers ESPN NFL sync → verifies `rosterAssignments` rows written for all teams in the current season AND depth chart seeded with ESPN depth rankings.
2. **`e2e/coach-depth-chart.spec.ts`** — Coach signs in, reorders their own team's QB depth chart, confirms audit log row created, then attempts to edit another team's depth chart and verifies 403.

---

## 10. Rollout Plan

| Phase | Scope | Flag | Duration |
|-------|-------|------|----------|
| 0 | Minimum slice: depth chart reorder + season edit lock only (no attributes, no audit log UI, no sync changes). Can ship ahead of Phase 1 if scope pressure forces a cut. | `depth_chart_v1` (reuse) | 1 week |
| 1 | §5.1 Rosters + §5.2 Depth chart + §5.5 Audit log | `roster_snapshots_v1`, `depth_chart_v1` | 2–3 weeks |
| 2 | §5.3 Attributes + development | `player_attributes_v1` | 2 weeks |
| 3 | §5.4 Schedules + standings | `schedules_standings_v1` | 2–3 weeks |

Phase 0 exists to satisfy the Q7 working assumption (§2.1) — ship the single differentiator standalone if Phase 1 slips. Phase 1 supersedes Phase 0 by layering rosters and audit log on top of the same depth-chart mutation surface.

Each phase requires: passing CI, E2E green, manual QA in a preview deploy, then flag flip in production.

---

## 11. Open Questions

1. **Tier gating** — do attributes and audit log require paid tier (`club`/`league`)? Default assumption: yes for attributes, no for audit log.
2. **Coach result entry** — can coaches submit results for admin approval, or admin-only in v1? Default: admin-only.
3. **PFF licensing** — paid feed, scrape, or admin-uploaded CSV/JSON? v1 ships with admin-uploaded JSON.
4. **Salesforce mirror timing** — ship Convex-only in Phase 1, mirror to SF in Phase 2? Default: yes.
5. **Per-team Coach assignment** — when do we split "Team Manager" from "League Admin" at the Clerk role level? v2 concern.

## 11.1 Decision log

Append a row any time a §2.1 working assumption or §11 default is overridden. Initial rows capture the v1 working assumptions so an override is always visible as a replacement, not an omission.

| Date | Question | Decision | Owner |
|------|----------|----------|-------|
| initial | Q1 North star | Hybrid: depth chart + season roster + audit log first | (unassigned) |
| initial | Q2 Audience | Admin + Coach (same Clerk role in v1); Viewer read-only | (unassigned) |
| initial | Q3 Sport scope | American-football-first canonical `positionSlot` taxonomy | (unassigned) |
| initial | Q4 Season binding | Per `(team, season)` via `rosterAssignments`; `players` identity stays global | (unassigned) |
| initial | Q5 Write frequency | Audit log on every mutation; no undo UI in v1 | (unassigned) |
| initial | Q6 Public vs private | Dashboard-authenticated users only in v1 | (unassigned) |
| initial | Q7 v1 must-have | Depth chart + season edit lock; Phase 0 fallback (§10) | (unassigned) |
| initial | Open Q1 Tier gating | Attributes gated to `club`/`league`; audit log ungated | (unassigned) |
| initial | Open Q2 Coach result entry | Admin-only in v1 | (unassigned) |
| initial | Open Q3 PFF licensing | Admin-uploaded JSON in v1 | (unassigned) |
| initial | Open Q4 SF mirror timing | Convex-only Phase 1; Salesforce mirror in Phase 2 | (unassigned) |
| initial | Open Q5 Per-team Coach | Deferred to v2 | (unassigned) |
| 2026-04-16 | Sprint plan | Sprint plan created in Linear team ARC, project "Sprtsmng Roster Management": WSM-000001–WSM-000046 (ARC-102 through ARC-147). 4 parent epics, 42 child stories, 41 Blocked-by relations. | Andrew Solomon |
| 2026-04-17 | Sprint 0 (pre-roster) | Platform-foundation sprint added in new Linear project "Sprtsmng Infrastructure": WSM-000047–WSM-000056 (ARC-148–ARC-157). 1 epic + 9 children. Closes release automation + commit enforcement + branching gaps BEFORE WSM-000002 (Phase 0) execution begins. | Andrew Solomon |

---

## 12. Glossary

| Term | Meaning in this doc |
|------|---------------------|
| **Roster** | The set of `rosterAssignments` rows for a (teamId, seasonId) pair |
| **Snapshot** | Synonym for a season's roster — frozen historical record, not mutated after season close |
| **Depth chart** | Per-position ordered list of active roster players by `depthRank` |
| **Position slot** | Canonical single-position string (e.g. `"QB"`, `"LT"`) used on the depth chart |
| **Position group** | Coarser grouping used for attribute schemas (e.g. `"OL"` covers LT/LG/C/RG/RT) |
| **Fixture** | A scheduled game between two teams in a season |
| **Standing** | Computed aggregate per team: W/L/T, points, ranks |
| **Audit log** | Append-only record of every roster mutation |
| **Attribute** | 0–99 skill rating for a player; nullable; weighted average of PFF + Madden source values |
| **Weighted overall** | Single-number summary of a player's attributes for display/ordering |

---

## 13. Critical Files (for AI agents orienting)

| File | Why it matters |
|------|----------------|
| `apps/web/convex/schema.ts` | Current data model — extend here for new tables |
| `apps/web/convex/sports.ts` | Existing Convex mutations/queries — follow the same patterns |
| `apps/web/src/lib/authorization.ts` | `authorizeTeamMutation`, `getUserTier` — extend, don't replace |
| `apps/web/src/lib/org-context.ts` | `resolveOrgContext` — use for league visibility |
| `apps/web/src/lib/salesforce-api.ts` | jsforce bridge; the Salesforce mirror goes through here |
| `apps/web/src/lib/adapters/espn-nfl.ts` | ESPN sync — extend for rosters + attributes |
| `apps/web/src/app/api/cron/nfl-sync/route.ts` | Cron trigger for sync |
| `packages/shared-types/src/index.ts` | DTO home |
| `packages/api-contracts/src/` | Zod schemas; colocate roster/attribute/fixture/result schemas here |
| `sportsmgmt/main/default/objects/` | Salesforce object definitions to mirror |
| `sportsmgmt-football/` | Target package for football-specific metadata + attribute schemas |

## 14. Related Docs

- `docs/README.md` — project-wide doc index
- `docs/launch/pre-launch-checklist.md` — release gates
- `docs/sprints/` — sprint plans; roster features will be broken into stories there
- `docs/external-frontend/` — frontend conventions

---

*End of design document. Implementation proceeds phase-by-phase under the feature flags in §8.*

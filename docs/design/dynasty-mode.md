# Dynasty Mode

Status: approved design (2026-07-05). Decisions confirmed: graduates are archived (never
deleted); class year reuses the existing `grade` field (9–12 ↔ FR/SO/JR/SR); progression is
seeded and position-weighted (~+2–4 OVR/year mean with variance, larger FR→SO jumps);
freshman generation tops rosters back to the existing target size.

## Context

Seasons today are one-offs: created manually (`upsertSeason`; first season `active`, later
`upcoming`), activated via `setActiveSeason` (demotes the previous active season to
`completed`), with no continuity between years. But the data model is already dynasty-shaped:

- `players` carry `grade?` (9–12), `squad?` (Varsity/JV by grade), `experienceYears?`,
  `status`, and DOB derived from grade at generation. Players are league-global
  (season-agnostic) documents.
- `playerAttributes` snapshots are per `(playerId, seasonId)` — the development chart
  ("weighted overall by season") renders progression automatically once a new season's
  snapshots exist.
- `copySeasonRosters` already clones `rosterAssignments` + `depthChartEntries` from the most
  recent prior season into a target season.
- Roster/schedule/stats/playoff state is season-scoped; nothing needs migrating on rollover.

## Offseason rollover (one admin action: "Start next season")

Preconditions: an `active` season exists and is **decided** — its playoff champion is decided
when a bracket exists, else all fixtures final. Errors: `no_season`, `season_not_decided`,
`next_season_exists`.

1. **Create** the next season as `upcoming` via the existing `upsertSeason` path (name derived
   by incrementing the year in the current season name, e.g. "2026" → "2027").
2. **Graduate**: players with `grade === 12` on rosters in the league get
   `status: "graduated"`. Documents, stats, and attribute history are never deleted.
3. **Advance**: all other rostered players get `grade + 1`, recomputed `squad`
   (Varsity/JV by the existing grade rule), `experienceYears + 1`.
4. **Progress**: for each advanced player, write a NEW attribute snapshot for the new season
   through the existing ingest path: previous season's canonical attributes + a seeded,
   position-weighted development delta (mean +2 to +4 overall-equivalent per year; larger for
   grade 9→10; per-attribute variance so players can bust or break out; clamp 0–99).
   Deterministic per (playerId, newSeasonId).
5. **Carry over**: `copySeasonRosters` into the new season, then remove graduated players'
   assignments/depth entries.
6. **Recruit**: generate a freshman class (`grade: 9`) per team, topping rosters back to the
   existing target size using the synthetic generator with league-scoped name dedup. Requires
   a class-targeting option on the generator (today it only tops up numerically with random
   grades).
7. The new season stays `upcoming` — that IS the offseason: generation gates (#460
   `isSeasonStarted`) are open, coaches/admins can curate. Activating the season starts the
   year (existing `setActiveSeason` demotes the old one to `completed`).

## Included fix: current-season fallback

`currentSeasonId` falls back to the FIRST season in a league when none is active. In a
multi-season dynasty league this silently makes the oldest completed season the default
context. Fix in D1: fall back to the most recently created season instead. (Sibling bug —
`deleteSeason` orphaning depth/live/playoff rows — is tracked separately, not in D1.)

## Slices

- **D1 (this slice):** rollover backend — internal mutations + `startNextSeasonAction` +
  generator class-targeting + fallback fix + tests. No UI beyond what testing requires.
- **D2:** League-view dynasty panel — "Start next season" CTA with decided-state gating,
  class-distribution summary (FR/SO/JR/SR counts), graduated-players list; FR/SO/JR/SR labels
  on player surfaces.

## Invariants

- All new Convex writes are `internalMutation` (WSM-000096); server action holds the
  role gate (admin-only — org-settings level, not coach).
- Rollover is idempotent-safe: re-invoking after success returns `next_season_exists`.
- No changes to `packages/api-contracts` contracts; `grade`/`status` fields already exist in
  DTOs.
- Graduated players never appear in new-season rosters, depth charts, or generation dedup
  exclusions (their names may recur — real schools reuse names).

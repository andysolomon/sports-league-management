# PRD — Football Stat-Keeping Keystone (WSM-000112)

**Status:** **v1 SHIPPED (2026-06-17), behind the `stat_keeping_v1` flag** (on in
preview/dev, off in prod until enabled). The validation gate was **lifted** by
product decision — we build to demand directly, not interview-gated (#309 closed). v1 landed across five PRs:
PR1 data layer (#330), PR2 box-score entry UX (#331), PR3 season totals (#332),
PR4 MaxPreps export (#333), PR5 SPRT-from-game-stats (#334).
Pairs with [coach-platform-competitive-teardown.md](./coach-platform-competitive-teardown.md).

## 1. Problem & goal

HS football coaches are **required** to submit box scores to MaxPreps for playoff
eligibility. MaxPreps' entry is buggy and tedious; GameChanger has **no football stats**;
nobody can score live while coaching. So coaches re-enter stats into a tool they don't like.

**Goal:** let a coach (or their stat-keeper) enter a game's box score **once, fast, on a
phone, after the game**, in a tool they already use for their roster/depth chart — and
**export it to MaxPreps** so the mandate is satisfied with no double-entry. As a byproduct,
real-game stats power our SPRT ratings at the HS level — something no competitor offers.

**Non-goal (v1):** live in-game scoring, film/video, advanced analytics, play-by-play.

## 2. Strategic fit

This is the **keystone** of the "beat MaxPreps for coaches" wedge. It only works on top of
the **Hybrid fork** model already shipped (the coach owns + edits their team). It inverts the
GameChanger↔MaxPreps relationship: **we are the system of record; MaxPreps is a downstream
export** — eliminating the dual-roster maintenance that breaks GameChanger's sync.

## 3. Users & jobs-to-be-done

- **Stat-keeper** (coordinator, GA, trusted parent — _the primary user_): "Enter Friday's box
  score quickly and correctly, from the final book or the film, and get it to MaxPreps."
- **Head coach**: "See accurate team + player stats; not have to babysit data entry."
- **Player/parent (later, read):** "See my stat line and season totals."

## 4. Key product decisions

1. **Post-game, not live.** The HC can't score while coaching; the real job is fast entry
   after the game (from the book or film). v1 optimizes for **single-operator post-game box
   scores**. (Live/play-by-play is a later phase.)
2. **Box-score totals first, not play-by-play.** Enter each player's game line
   (e.g. "QB: 18/27, 243 yds, 3 TD, 1 INT"). MaxPreps itself supports season-to-date totals to
   avoid play-by-play — totals are the fastest path to the mandate.
3. **Roster-driven.** The team's roster (already in the app) pre-populates the entry form —
   no re-typing names/numbers. This is the anti-dual-maintenance advantage.
4. **Owner-edits-only.** Only a **coach or admin** of the team's league/owner org can
   enter/edit a team's stats (shipped as `canManageTeam`, matching the stat-keeper persona +
   the "coaches run game ops" stance, WSM-000121) — keeps random parents out, fixing
   MaxPreps' "parents can manipulate scores" integrity gap.

## 5. Scope

**In (v1):**
- Per-game, per-player box-score entry for one team (your claimed team), mobile-first.
- Team score by quarter + final.
- Persisted per game (fixture) and aggregated to season totals.
- **MaxPreps-compatible export** (file download) for a game.
- Stats feed the SPRT rating engine for HS players.

**Out (v1):** opponent stats, live entry, play-by-play, kicking/punting depth beyond basics,
film, public stat leaderboards, automatic MaxPreps API push (manual upload first).

## 6. The football box-score stat model

Per-player game line, grouped (capture only the groups relevant to a player's snaps):

| Group | Fields |
| --- | --- |
| Passing | comp, att, yards, TD, INT, (sacked) |
| Rushing | carries, yards, TD, long |
| Receiving | rec, yards, TD, long, targets |
| Defense | tackles (solo/assist), TFL, sacks, INT, pass-def, FF, FR, def TD |
| Kicking | FG made/att, XP made/att |
| Punting | punts, yards, long |
| Returns | KR/PR count, yards, TD |
| Ball security | fumbles, fumbles lost |

Team-level: score by quarter, total; (W/L derives from the existing standings layer).

> **Open:** the exact field set + units must match MaxPreps' import file. Confirm via coach
> upload screens (interview guide Block D) before finalizing the schema.

## 7. Data model

- New table **`playerGameStats`**: `{ fixtureId, playerId, teamId, seasonId, statsJson,
  enteredBy, updatedAt }` — one row per player per game. (`statsJson` = the box-score line;
  a typed shape validated at the edge, like SPRT/Madden attributes.)
- Ties into existing **`fixtures`** (the game) and **`gameResults`** (final score) from the
  schedules feature; the reserved `gameResults.playerStatsJson` hook is superseded by this
  table for queryability.
- **Season totals** = aggregation over a player's `playerGameStats` rows (indexed by
  `playerId`/`seasonId`). Powers profiles + SPRT.

## 8. Entry UX (mobile-first)

- From a game (fixture) on the owned team → **"Enter stats"**.
- Roster list; tap a player → a compact, position-aware stat sheet (show passing for the QB,
  rushing/receiving for skill players, etc.; "+ add stat group" for anything else).
- Big tap targets, numeric keypads, autosave per field; no required live timing.
- A **box-score review** screen (team totals + each player line) before marking the game
  "stats final."
- Designed so one person, looking at the final book or film, finishes a game in minutes.

## 9. MaxPreps export

- From a completed game (or a season) → **"Export for MaxPreps"** → download a file in
  MaxPreps' accepted **manual stat-upload** format: a **pipe-delimited `.txt`** (Supplier ID +
  `Jersey|<fields>` header + one row per player — see [maxpreps-import-format.md](./maxpreps-import-format.md)).
- Carries **our roster identities + stats together**, so there's no "did you also add them on
  MaxPreps?" mismatch (the GameChanger failure mode).
- v1 = manual download + upload by the coach (same path Hudl uses). A contracted MaxPreps
  **stat-partner** push is a later upgrade, not a v1 dependency.

## 10. SPRT integration

Real HS game stats feed the existing SPRT engine (z-score per position group → 0–99), giving
coaches **player ratings derived from their own games** — a differentiator no competitor has
at HS. Reuses the rating pipeline; swaps nflverse inputs for `playerGameStats` aggregates.

## 11. Acceptance criteria (Gherkin)

### Scenario: Enter a game's box score
**Given** a coach who owns a team and a played game (fixture)
**When** they open "Enter stats" and fill a few players' lines + the quarter scores
**Then** the stats persist per game and roll up into each player's season totals

### Scenario: Only the owner edits
**Given** a team claimed by org A
**When** a user who is not an admin of org A tries to enter stats
**Then** the action is rejected (reuses team-ownership authorization)

### Scenario: Export to MaxPreps
**Given** a game with stats entered
**When** the coach taps "Export for MaxPreps"
**Then** they get a file in MaxPreps' accepted import format covering that game's player stats

### Scenario: Stats power ratings
**Given** a player with several games of entered stats
**When** the SPRT refresh runs for the league
**Then** the player's rating reflects their real game production

## 12. Phasing

1. **v1 — box-score entry + export** (this PRD): per-player game lines, season totals,
   MaxPreps export, SPRT feed.
2. **v2 — play-by-play / drive entry**: richer data, auto-derives the box score; better SPRT.
3. **v3 — live entry** (single dedicated operator) + GameChanger-parity engagement.
4. **v4 — MaxPreps stat-partner push** (API) + opponent stats + public leaderboards.

## 13. Risks & open questions

- **MaxPreps import format** — ~~blocker~~ **RESOLVED & built** ([maxpreps-import-format.md](./maxpreps-import-format.md)):
  exact Football/Boys field names captured; TXT-export generator shipped (PR4, #333).
  _Residual:_ the 32-char Stat Supplier ID — a build-time, account-bound credential
  (`MAXPREPS_SUPPLIER_ID`); a placeholder line ships until it's set.
- **Will coaches enter stats here vs. their existing flow?** — the demand question. Per the
  no-validation-gate decision, we answer it by **shipping and watching usage** (success
  metrics below), not by gating on interviews.
- **Entry speed** — if it's slower than typing into MaxPreps, it fails. Usability-test the
  shipped entry form with a real book.
- **Accuracy/trust** — owner-edit auth helps (coach/admin only); bad data kills credibility.
  Follow-up: a "stats final" lock + edit history (not in v1).

## 14. Dependencies

- ✅ Hybrid fork / team ownership (#226–228) — coaches own + edit their team.
- ✅ Schedules / fixtures + game results — the "game" to attach stats to.
- ✅ SPRT engine — reused for HS ratings (PR5 added a box-score-only HS model).
- ~~🔬 Coach-interview validation~~ — **removed** as a gate (2026-06-17 product decision).
  Build to demand directly.

## 15. Success metrics (post-launch)

- % of a coach's games with a complete box score entered here.
- Median minutes to enter a full game's box score.
- % of games exported to MaxPreps from here (vs. re-entered elsewhere).
- Coaches retained week-over-week through a season.

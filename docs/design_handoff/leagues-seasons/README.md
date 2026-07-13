# Handoff: Leagues & Seasons redesign (Teams, Seasons, Leagues)

## Overview

Interactive prototype of the full **Leagues & Seasons operator experience**: overview
dashboard, league info + manage split, seasons list, season hub, teams, players,
divisions, schedule, standings, playoff bracket, a right-docked GameView drawer
(matchup preview / gamecast recap), and the dynasty season-lifecycle flows
(create → activate → complete → roll over).

The prototype models one hard-coded league ("Cobb County Football", 16 teams,
2 divisions, 11-week round-robin, 8-team single-elim playoff) with two seeded
seasons (2026 completed with a champion, 2027 active with the regular season
complete). Everything runs client-side against localStorage.

## About the design files

- `../prototypes/Leagues & Seasons - Prototype.html` — the prototype as delivered.
  **Open it directly in a browser to click through it.** It is a self-bundled
  React app: the JSX source is gzip+base64-compressed inside the file and is not
  greppable.
- `decoded/` — the extracted, readable source (produced by `decoded/decode-prototype.mjs`;
  re-run with `node decode-prototype.mjs <html> <outdir>` if the prototype is
  re-delivered). **This is the reference for implementation.** Modules in load order:

  | File | Contents |
  |---|---|
  | `03-*.js` | Data + pure logic: seed data, round-robin scheduler, standings, bracket seeding, deterministic sim, gamecast synthesis |
  | `04-*.js` | UI primitives on `.sl-*` classes: Button, Badge, StatusBadge, Card, TeamMark, Select, Segmented, Spinner, Modal/DialogHead/DialogFooter, ConfirmDialog, ProcessingModal, Sheet, AccordionSection, Toaster |
  | `05-*.js` | Store: root state, derived helpers, all actions |
  | `06-*.js` | League-side screens: Overview, Leagues, League (info), Manage league, DynastyPanel, lifecycle flows |
  | `07-*.js` | Seasons list, New season dialog (2-step), Season hub |
  | `08-*.js` | Teams table + TeamDetailSheet drawer |
  | `09-*.js` | Players (Cards/List views, search, filter, sort, pagination) |
  | `10-*.js` | Divisions (per-division standings cards) |
  | `11-*.js` | GameView drawer: preview + gamecast recap |
  | `12-*.js` | Schedule (accordion weeks), Standings, Playoff bracket, season sub-header |
  | `13-*.js` | Tweaks-panel scaffold — prototype tooling, **ignore** |
  | `14-*.js` | App shell: sidebar, topbar, router, confirm/process context |
  | `template.html` | The inline design-system CSS (all `.sl-*` classes + tokens) |

## Fidelity

- **Layout, hierarchy, copy, and flows: high fidelity.** Headings, table columns,
  badge labels, dialog copy, and confirmation flows below are verbatim from the
  prototype and should be reproduced (adjusting only where real data differs).
- **Styling: use the app's existing tokens/Tailwind bridge** (`apps/web/src/app/globals.css`),
  not the prototype's inline CSS. The prototype's tokens are the same names/values
  as `packages/design-system/tokens` (dark default, green accent `#46c964`,
  Hanken Grotesk + JetBrains Mono, `[data-accent]`, `[data-round]`, `[data-density]`
  axes) — nothing new to port at the token level.
- **Behavior: real data, not the prototype's client-side sim.** See
  "Do not replicate" below.

## What already exists vs. what's new

The Convex backend already supports nearly everything the prototype shows
(season lifecycle + durable rollover, playoffs, standings, schedule generation,
synthetic rosters). This handoff is overwhelmingly a **UI redesign**, not a data
project.

| Prototype screen | Current route | Status |
|---|---|---|
| Overview | — (no dashboard overview of the league) | **New** page |
| Leagues (list) | `/dashboard/leagues` | Redesign (currently one card + accordion) |
| League (info destination) | — | **New** — prototype splits read-oriented League page from Manage |
| Manage league | `/dashboard/leagues/[id]` | Redesign (currently a stacked admin form) |
| Seasons list | `/dashboard/seasons` | Redesign (rows → richer rows w/ archive meta + actions) |
| New season dialog | `CreateSeasonButton` | Redesign into 2-step dialog |
| Season hub | `/dashboard/seasons/[id]` (WSM-000213) | Redesign (banners, progress card, standings card) |
| Schedule | `/dashboard/leagues/[id]/schedule` | Redesign (accordion weeks, completed-games sub-accordion) |
| Standings | `/dashboard/leagues/[id]/standings` | Redesign (playoff-cut divider, "Clinched" badge) |
| Playoffs | `/dashboard/leagues/[id]/playoffs` | Redesign (phase-gated bracket, TBD placeholders) |
| Teams | `/dashboard/teams` | Redesign — thinnest current page; standings-sorted table |
| TeamDetailSheet | `/dashboard/teams/[id]` (full page) | **New** drawer pattern (page remains for deep links) |
| Players | — (rosters only per-team) | **New** league-wide players page |
| Divisions | — | **New** page |
| GameView drawer | gamecast work (see `../gamecast/`) | **New** preview state; recap overlaps gamecast handoff |
| Import / Billing / Discover | — | Placeholders in prototype — **out of scope** |

**Component strategy (decided 2026-07-13): shadcn.** Keep shadcn +
Tailwind-on-tokens (the current dashboard pattern); add the missing primitives
as shadcn components (`sheet`, `alert-dialog`, `sonner` toasts, `accordion`)
plus small app components (`TeamMark`, `ProcessingModal`; `StatusBadge` already
exists). `packages/design-system/react` stays unadopted in the dashboard; the
prototype's `.sl-*` vocabulary maps onto shadcn equivalents.

## Screens / Views

Shell: fixed 248px sidebar (brand, nav: Overview, Leagues, Discover, Teams,
Players, Seasons, Divisions, Import, Billing; footer caption) + topbar (back
button when history exists, league-switcher button, ⌘K search box, theme toggle,
account menu). Nav highlight groups league/manage/schedule/standings/playoffs
under **Leagues** and season under **Seasons**.

### Overview
"Your league at a glance." Two cards: league summary (active season, regular-season
progress "X / Y played", team count; buttons **Open league**, **Seasons**) and
**Standings** top-5 with "Full standings →".

### League (info) — the read destination
Header: league name + `Organization` badge + "16 teams · N seasons"; actions
**Manage**, **Seasons**. Conditional banners: season-complete (champion) or
"Regular season complete — seed the bracket to begin the playoffs" with **Start
playoffs**. Grid: "Current season" card (status badge, progress, playoff format,
links to Schedule/Standings/Playoffs) + Standings top-5. Teams grid of tiles
(TeamMark, name, "record · mascot"). DynastyPanel card when a season is active.

### Manage league
Settings rows: League name (Rename), Members & invites, Visibility
(Organization|Public segmented — maps to existing `isPublic` toggle), Teams (Add
team), Synthetic rosters (Generate rosters / Generate attributes), Danger zone
(Delete league). Maps closely to today's `/dashboard/leagues/[id]` capabilities.

### Seasons list
Per-league card, seasons sorted active-first then year desc. Each row: name link,
status badge, date range, meta ("X / Y games" · leader "Team (W-L)" · 🏆 champion).
Row actions: **Make active** / **Complete**, **Copy rosters**, rename, delete.
**New season** opens the 2-step dialog (step 1: name required, start/end dates,
playoff teams None/4/8/16, format Single/Double elim; step 2: success + **Generate
schedule** shortcut).

### Season hub
Header (name, status badge, league link, date range) + nav links Schedule /
Standings / Playoffs / Stat leaders. Banners: offseason "no schedule yet" →
**Generate schedule**; regular season complete → **Start playoffs**. Cards:
Season progress (regular, playoffs, format, champion) + Standings. DynastyPanel.

### Teams
Standings-sorted table: `#`, Team (TeamMark + name), Division, Record, PF, Diff,
Roster (n/48). Rows open **TeamDetailSheet** (560px drawer): division badge +
"#rank overall", hero (mark, name, mascot, OVR), stat grid (Record, Win %, Diff,
PF, PA, Roster), "Form · last 5" W/L/T chips, division-standing row link, "Key
players" (4), actions **View in standings** / **Schedule**. The existing
`/dashboard/teams/[id]` page stays for deep links/roster management.

### Players
League-wide roster view. Toolbar: Cards|List segmented (persisted), position-group
segmented (All/Offense/Defense/Special), search "Search players or teams…".
Cards: name, "POS · team", TeamMark, OVR chip, jersey chip, status badge
(Active=success, Injured=warning, else neutral). List: sortable Name/Team/Pos/#/
OVR/Status. Pagination (24 cards / 25 rows) with "Showing a–b of total".

### Divisions
One card per division: header (name + count badge), current leader (🏆), table
`#`/Team/Record/PF/Diff, rank 1 gets `Leader` success badge. Rows open
TeamDetailSheet.

### Schedule
Season sub-header (season dropdown). Accordion weeks (auto-open where unplayed
games exist), nested "Completed games (n)" sub-accordion, Expand/Collapse all,
per-week **Sim**, Simulate menu. Fixture rows open GameView.

### Standings
Full table with dashed playoff-cut divider after seed `playoffTeams` and
`Clinched` badges above the cut.

### Playoffs
Phase-gated: no config → ready ("seed the bracket") → in progress → decided.
Bracket columns by round (Quarterfinals/Semifinals/Final labels), TBD placeholders,
matchup cards open GameView. Actions: **Advance to {round}**, **Play championship**.

### GameView drawer (640px)
Header: `Preview`/`Final` badge + round/date. Scoreboard with TeamPills
("#seed · mascot").
**Preview:** "Projected line" banner ("Pick'em" or "{fav} by {spread}"), "Tale of
the tape" (Record / Team rating / Form), two Key-players cards, actions **Sim
game**, **Record result** (inline two-score form), Go live.
**Recap:** champion banner when decisive, quarters table, win-probability chart,
scoring summary, two Leaders cards, **Box score**, **Edit result**.

## Season-lifecycle flows (confirmation copy is part of the design)

- **Activate with undersized rosters** → confirm dialog listing "{team} (n/48)"
  with **Proceed anyway** + extra action **Auto-fill rosters** (runs a
  ProcessingModal steplog, then activates).
- **Regenerate schedule** → danger confirm "Existing fixtures and any recorded
  results will be removed. This can't be undone."
- **Complete season** → confirm; stronger "Complete season anyway?" copy when no
  champion is decided ("Completing locks schedule generation, result recording,
  and simulation.").
- **Start next season (dynasty)** → gated (needs decided champion, no existing
  upcoming season, no unplayed games; each gate has explicit message). Confirm:
  "Seniors graduate, every other player advances a grade, and a new freshman
  class is generated." ProcessingModal steps: Creating next season → Graduating
  seniors → Advancing player grades → Writing attribute snapshots → Copying
  rosters forward → Recruiting freshman class. Success toast "{graduated}
  graduated · {advanced} advanced · {freshmen} freshmen generated".
  DynastyPanel shows FR/SO/JR/SR class-distribution counts.

These map directly onto the existing `completeSeason` / `beginSeasonRollover` /
`advanceSeasonRollover` / `setActiveSeason` mutations (WSM-000243) — the
ProcessingModal steplog is the UI for the real staged rollover, which is
genuinely async (unlike the prototype's cosmetic delays).

## Do not replicate (prototype-only behavior)

- **Instant score-synthesized simulation** (`simGame` from static `ovr` + noise)
  and the **fabricated gamecast** (quarters, win-prob, scoring plays, and leader
  statlines derived from the final score). This contradicts the sim roadmap:
  play-by-play engine first, no score-derived synthesis. Wire GameView recap to
  real `gamePlayLogs` / `playerGameStats`; keep "Sim" buttons wired to the real
  simulation surface.
- **localStorage state / single hard-coded league / rosters-as-counts /
  league-global class distribution.** The real app is multi-tenant with real
  player records (which are per-player-grade — better than the prototype).
- **Non-functional stubs:** New league, Members & invites (exists already —
  keep the real one), Go live, Box score, Stat leaders link, Import, Billing,
  Discover, ⌘K search.
- Playoff format "Double elimination" is offered but unimplemented in the
  prototype; the backend already supports both — keep the real behavior.

## Constraints the redesign must respect

- Server-side permission gating (org admin vs coach vs viewer) — prototype is
  operator-only; every manage affordance must stay behind the existing checks.
- League visibility is an access boundary (404, don't leak existence).
- Feature flags gate standings/schedule/stats/playoffs routes.
- All writes go through `apps/web/src/lib/data-api.ts` server wrappers
  (Convex mutations are `internalMutation` only).
- One active season per league; rollover is a durable one-to-one claim.

## Design tokens

Identical names to `packages/design-system/tokens` / `apps/web/src/app/globals.css`
(`--bg --surface --surface-2 --surface-3 --border --border-strong --text
--text-muted --text-subtle --primary --primary-fg --primary-hover --danger
--danger-strong --accent --accent-soft`, spacing `--space-1..10`, `--r/--r-lg`,
theme/accent/round/density axes). Use the existing Tailwind bridge; no literals.

## Files in this bundle

- `README.md` — this spec
- `decoded/` — readable prototype source + decoder script (see table above)
- `../prototypes/Leagues & Seasons - Prototype.html` — runnable prototype

## Target files in your repo

- `apps/web/src/app/dashboard/leagues/page.tsx`, `leagues/[id]/*` (info/manage split)
- `apps/web/src/app/dashboard/seasons/page.tsx`, `seasons/[id]/page.tsx`
- `apps/web/src/app/dashboard/teams/page.tsx` (+ new TeamDetailSheet component)
- New: players + divisions pages under `apps/web/src/app/dashboard/`
- `apps/web/src/components/schedule/*` (StandingsTable, ScheduleWeeks, fixture rows)
- `apps/web/src/components/playoffs/*`, `components/dynasty/DynastyPanel.tsx`
- New shared primitives per the component-strategy decision above
- Data layer: `apps/web/src/lib/data-api.ts` (existing surface should cover it)

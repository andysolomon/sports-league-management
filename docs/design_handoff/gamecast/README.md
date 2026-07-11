# Handoff: Gamecast redesign (Sim & Review modes)

## Overview
A redesign of the Gamecast screen for the `sports-league-management` app. The
current Gamecast (a plain scoreboard + an SVG drive chart that renders as
floating colored blobs) is hard to read. This redesign turns it into a
broadcast-quality, ESPN-style game viewer with a legible drive chart, a field-
position visualization, win probability, box score, and scoring summary — and
adds two explicit modes:

- **Sim mode** — watch a simulated game unfold play-by-play. Auto-advance
  (play/pause + 0.5×/1×/2×/4× speed), step controls, "LIVE" status. Only
  revealed plays/drives are shown; future is hidden.
- **Review mode** — scrub a finished game. A full timeline slider jumps to any
  play; the field, score, clock, win probability and stats all reflect the
  state **at the selected play**. Full play-by-play is visible with the current
  play highlighted.

Both modes are driven by the **same persisted `PbpGameLog`** you already store
per simulated fixture — no new backend data is required.

Three layout directions are included (see Screens). Pick one to ship, or mix.

## About the design files
`Gamecast.dc.html` is a **design reference created in HTML** — a working
prototype showing the intended look and behavior. It is **not** production code
to copy. Your task is to **recreate these designs in the real app** (Next.js /
React, `apps/web/src/components/gamecast/…`) using the existing
`@/lib/pbp` + `@/lib/gamecast` modules and the `packages/design-system`
component library and CSS tokens.

The prototype's simulation engine (inside the HTML's logic class) is only there
to make the prototype interactive standalone — **ignore it**. In the real app
you already generate and persist `PbpGameLog` via `simulateAndPersistFixture`
and load it in `gamecast/page.tsx` with `parseGamePlayLog`. Wire the redesigned
UI to that real log.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, layout, and interactions.
Recreate pixel-accurately using the design-system tokens and components. Where
the prototype uses inline hex/px, prefer the equivalent CSS variable
(`var(--surface)`, `var(--text-muted)`, `--space-*`, etc.) — the values were
taken straight from `packages/design-system/tokens`.

---

## What already exists vs. what's new

You already have (keep / extend):
- `apps/web/src/lib/pbp/{types,engine,index}.ts` — `PbpGameLog`, `PbpDrive`,
  `PbpPlay`, `allPlays()`.
- `apps/web/src/lib/gamecast/{reveal,drives,play-text,index}.ts` —
  `scoreAtPosition`, `clockAtPosition`, `nextPlayIndex`, `nextQuarterIndex`,
  `nextHalfIndex`, `entireGameIndex`, `restartIndex`, `revealedPlays`,
  `buildDriveChartSegments`, `groupPlaysByDrive`, `driveResultToken`,
  `driveResultLabel`, `formatDownAndDistance`, `describePlay`,
  `formatGameClock`, `formatQuarterLabel`.
- `apps/web/src/components/gamecast/{GamecastView,GamecastScoreboard,DriveChart,PlayList,GamecastControls,GamecastEmptyState}.tsx`.

New logic to add to `@/lib/gamecast` (pure functions, unit-testable like the rest):
- `prevPlayIndex(i)` → `Math.max(0, i-1)`.
- `prevQuarterIndex(plays, i)` / `prevHalfIndex(plays, i)` — mirror the existing
  `next*` functions. Simplest robust implementation: precompute the sorted list
  of quarter-end reveal indices (count of plays with `quarter <= q` for each q)
  and half-end indices (q≤2, q≤4, max); "next" = first boundary `> i`, "prev" =
  last boundary `< i`. (The prototype does exactly this.)
- `winProbabilityAtPosition(log, plays, i)` and a `winProbabilitySeries(log, plays)`
  returning `number[]` (home win % per reveal index, `[0]=50`). Model used in
  the prototype (tune to taste — this is presentation, not analytics):
  ```
  secLeft   = max(0, (4 - quarter)*900 + clockSeconds)
  margin    = homeScore - awayScore            // at this play
  posVal    = offenseTeamId === home ? +0.7 : -0.7
  z         = (margin + posVal) / (1.45 * sqrt(max(secLeft/60, 0.2)) + 0.4)
  p         = 1 / (1 + exp(-z))
  if secLeft <= 0: p = margin>0 ? .99 : margin<0 ? .01 : .5
  homeWin%  = round(clamp(p*100, 2, 98))
  ```
- `boxScoreAtPosition(log, plays, i)` → per-team `{ pass, rush, total, first, to, plays, pts }`.
  Aggregate over revealed plays: `pass += yardsGained` on `pass_complete`|`sack`;
  `rush += yardsGained` on `rush` (not turnover); `to++` on `isTurnover`;
  `first++` when `(rush|pass_complete)` and `yardsGained >= distance`;
  `plays++` on scrimmage plays; `pts` from `scoreAtPosition`.
- `scoringSummaryAtPosition(log, plays, i)` → ordered list of scoring plays
  (exclude `extra_point`; keep TD/FG) with `{ team, quarter, clockSeconds, kind, points, homeScore, awayScore }` (running score).

New components (`apps/web/src/components/gamecast/`):
- `FieldPosition.tsx` — the football-field SVG (see Field position below).
- `WinProbability.tsx` — area/line chart.
- `BoxScore.tsx` — team-stats table (use the DS `Table`).
- `ScoringSummary.tsx` — scoring list.
- `ModeToggle` (use DS `Segmented`, options `["Sim","Review"]`).
- Rework `GamecastControls.tsx` to add prev-play / prev-quarter / prev-half /
  play-pause / speed / scrubber (see Controls).

State lives in `GamecastView` (client component): a single
`playIndex` (0 = pre-kickoff … `plays.length` = final) plus `mode`, `playing`,
`speed`. Everything else derives from `playIndex`.

---

## Screens / Views

There is **one screen** (the Gamecast) shown in **three layout directions**.
All three share the same panels and the same controls; they differ only in
arrangement/emphasis. Screenshots in `screens/`.

Shared shell: outer wrapper is `.sl-root` with `data-theme` / `data-accent`,
`1px var(--border)`, `var(--r-lg)` radius, `var(--bg)` background,
`overflow:hidden`. Panels are DS `Card`s (`var(--surface)`, `1px var(--border)`,
`var(--r-lg)`) with a header row: uppercase mono eyebrow
(`700 11px/1 JetBrains Mono`, `letter-spacing 1px`, `var(--text-muted)`) +
`1px var(--border)` bottom divider.

### 1a — Broadcast (recommended default)
`screens/1a-broadcast.png`. Vertical stack:
1. **Scoreboard bar** — `var(--surface)`, 18–22px padding, bottom border. Top
   row: eyebrow ("Week 6 · Metro Division") left, **status badge** right. Below:
   large scoreboard (see Scoreboard).
2. **Controls bar** — `var(--surface-2)`, inline layout (mode + transport +
   speed on one row, scrubber/progress below).
3. **Situation strip** — big mono down-&-distance + muted context (see Situation).
4. **Body grid** — `grid-template-columns: 1fr 360px; gap:18px; padding:20px`.
   Left column: **Field position** card then **Drive chart** card. Right rail:
   **Win probability**, **Scoring summary**, **Team stats** cards.
5. **Play-by-play** — full-width card below the grid.

### 1b — Field-first (immersive)
`screens/1b-fieldfirst.png`. `grid-template-columns: 1fr 340px`, min-height 620.
Left: compact scoreboard + status → large **Field position** (h≈300) with the
situation centered above it and a slim **Drive chart** strip beneath → controls
(stacked variant) pinned at the bottom on `var(--surface-2)`. Right rail
(`var(--surface)`): **Win probability** on top, scrollable **Play-by-play**
filling the rest.

### 1c — Operator console (data-dense)
`screens/1c-console.png`. Matches the app's "calm operator console" tone.
Header bar: inline mono score `WHE 23 – 28 HIL`, a bordered clock chip
(`Q4 · 2:11` / `FINAL`), down-&-distance, status badge right. Three columns
`250px 1fr 300px`, min-height 560:
- **Left rail** (`var(--surface)`): Controls (stacked) → mini Field (h≈120, no
  legend) → Win probability (h≈90). Each under a tiny mono section label.
- **Center**: Drive chart (top, bordered) then Play-by-play (fills, scrolls).
- **Right rail** (`var(--surface)`): Team stats table → Scoring summary.

---

## Components (exact specs)

### Team identity
Two teams in the mock: **Wheeler (WHE)** `#3d6fe6` (home, left, drives L→R) and
**Hillgrove (HIL)** `#d1503a` (away, right, drives R→L). These are *content*
colors (team brand), the one place saturated color is allowed alongside the DS
green accent. In the real app pull team colors/abbr/name from the team records;
fall back to a neutral if none.

### Scoreboard
Row: `home col | center | away col`, `gap 20`. Team col = color chip (40×40,
`var(--r)` radius, white abbr `800 14px mono`; **3px `var(--accent)` ring when
that team has possession**) + name (`700 15px sans`) + record
(`var(--text-caption) var(--text-subtle)`) + score
(`800 34px mono` normal / `800 46px` big, `letter-spacing -1px`). Home col is
left-aligned, away col right-aligned (mirrored). Center: period eyebrow
(`700 11px mono`, `letter-spacing 2px`, uppercase; `var(--text-muted)`, or
`var(--accent)` when Final) over clock (`700 22–26px mono`). Period text:
`Pre-game` (index 0) / `Q1…Q4`,`OT1…` / `Final` (complete).

### Status badge (DS Badge)
- Sim, index 0 → `outline` "READY".
- Sim, in progress → `danger` "LIVE" with a pulsing 8px `var(--danger-strong)`
  dot (`@keyframes` opacity 1→.35→1, 1.1s).
- Sim, complete → `neutral` "FINAL".
- Review → `success` "REVIEW · <idx>/<total>" (count in mono).

### Situation strip
`formatDownAndDistance(cur)` as `800 22px mono` (`-0.5px`), a 1px `var(--border)`
vertical divider, then muted context (`<Team> ball · <spot>`). Spot label = side
abbr + yard from nearest goal, e.g. "WHE 44". If the current play scores, show a
`success` badge `+<pts> TD|FG|PAT` at the right. Pre-kickoff → "Awaiting kickoff
/ Press play to start the sim".

### Field position (the fixed drive chart's companion — new)
SVG, `viewBox 0 0 480 200`, `preserveAspectRatio:none`, `width:100%`,
`height` per layout (230 / 300 / 120). Geometry: two 60-wide end zones (left =
home color, right = away color, `opacity .9`, vertical white abbr `800 15px
mono`); 360-wide turf `var(--surface-2)`; yard lines every 10
(`var(--border)`, midfield `var(--border-strong)` 1.4px); hash marks at every 5;
yard numbers (10–50–10) `700 13px mono var(--text-subtle)`. Map chart yard
`c∈[0,100]` to `x = 60 + c*3`. Use `offenseToChartYard()` (already in
`drives.ts`) to place, from the current play:
- **First-down line** — 2.4px `#e0b64a` (gold) at `fieldPosition + distance`.
- **Line of scrimmage** — 2.4px `#4a9be0` (blue) at `fieldPosition`.
- **Ball** — brown ellipse `rx8 ry5 #c47b3a` white stroke at post-play spot.
- **Possession arrow** — short line + triangle in the offense team color,
  pointing L→R for home / R→L for away.
Legend row below (unless suppressed): "Line of scrimmage" (blue) / "First down"
(gold), `var(--text-caption) var(--text-subtle)`.

### Drive chart (redesign of the confusing one)
A **vertical list of drive rows**, newest at top, inside a scroll area
(`gc-list`, max-height per layout). Header row: `WHEELER ◄ … 50 … ► HILLGROVE`
in `700 10px mono`, `letter-spacing 1px`, uppercase, `var(--text-subtle)`.
Each row is a **clickable** `button`, grid `58px 1fr 132px`, `gap 12`,
`border-left: 3px <teamColor>`, `var(--r) 6` radius, `padding 7px 10px`,
`background var(--surface-2)` when it's the current drive:
- Col 1: team abbr (`700 12px mono` in team color) over start quarter
  (`10px mono var(--text-subtle)`).
- Col 2: a **field track** — `height 20`, `var(--surface)`, 1px border, `r5`,
  faint 50-yard center line; a horizontal **bar** from `min(start,end)%` to
  `max%` (`height 8`, `r4`) colored by result; a 12px **end dot** (team-result
  color, 2px `var(--surface)` ring) at the end position. Use
  `buildDriveChartSegments()` for start/end chart positions.
- Col 3 (right-aligned): result label (`600 12px sans`) over
  `<plays> pl · <±net> yds` (`10px mono var(--text-subtle)`).
Clicking a row sets `playIndex` to just after that drive's last play.
Empty state: "Drives appear here as the game is played."

**Result colors** (extend `driveResultToken`): current/live → `var(--accent)`;
touchdown → `var(--accent)`; field_goal → `#e0b64a` (gold); turnover / downs /
missed_field_goal → `var(--danger)`; end_of_half / end_of_game →
`var(--border-strong)`; punt / default → `var(--text-subtle)`.

### Play-by-play (extend existing PlayList)
Reverse chronological (newest drive on top; newest play on top within a drive).
Sticky drive header (`var(--surface-2)`, bottom border): team chip (color dot +
abbr, in team color) + result label (`600 11px mono var(--text-muted)`). Each
play is a **clickable** row (`onClick` → set `playIndex` to that play +1),
`borderBottom 1px var(--border)`, `padding 9px 14px`, `border-left 2px`
team-color when it's the current play, `background var(--surface-2)` when current:
top line = `formatDownAndDistance` (`600 11px mono var(--text-muted)`) +
`Q# m:ss` (`11px mono var(--text-subtle)`); body = `describePlay(p)`
(`var(--text-label)`, `var(--text)` when current else `var(--text-muted)`) with
a `+<pts>` in `var(--accent)` mono if scoring. **Review mode**: show all plays;
render not-yet-reached plays at `opacity .4`. **Sim mode**: only revealed plays.

### Win probability (new)
Header: home team chip (left) · `800 20px mono` current home-win % (center) ·
away chip (right). SVG `viewBox 0 0 100 100`, `preserveAspectRatio:none`, height
per layout: top half tinted home-soft `rgba(61,111,230,.18)`, bottom half
away-soft `rgba(209,80,58,.18)`, dashed midline `var(--border-strong)`. Plot the
series (`x = i/total*100`, `y = 100 - homeWin%`): filled area to the 50 line
(home color, `opacity .14`) + line (home color, 1.4px, `vector-effect:
non-scaling-stroke`), plus a vertical marker + dot at the current index. In sim
mode draw only up to `playIndex`; in review draw the full curve with the marker.
X-axis ticks: `Kickoff · Q2 · Half · Q4 · Final` (`10px mono var(--text-subtle)`).

### Box score / Team stats (DS Table)
Rows: Total yards, Passing, Rushing, First downs, Turnovers, Off. plays. Columns:
`Team stats | WHE | HIL` (team abbr headers in team color). Values right-aligned,
`mono 700`. From `boxScoreAtPosition`.

### Scoring summary (new)
List of scoring plays (from `scoringSummaryAtPosition`), newest first: `Q# m:ss`
(`11px mono var(--text-subtle)`, w52) · team color square (12px) · team abbr
(`700 12px mono` team color) · "Touchdown"/"Field goal" (`var(--text-label)`) ·
running score `23–28` (`700 13px mono`). Empty: "No scoring yet."

### Controls (rework GamecastControls)
Atoms: DS `IconButton`/`sl-iconbtn` for transport icons; DS `Segmented` for mode
and speed; DS `Button --primary` (44×40) for play/pause. **The DS Icon set has
no media glyphs** — add `play, pause, skip-forward (next), skip-back (prev),
skip-to-start, skip-to-end` to `components/icon/Icon.jsx` (filled triangles/bars,
`fill:currentColor`). Do **not** use emoji/unicode.

Transport cluster, left→right: `⏮ Restart` · `½` (prev half) · `Q` (prev
quarter) · `◀ prev play` · **▶/⏸ play-pause (primary)** · `▶ next play` · `Q`
(next quarter) · `½` (next half) · `⏭ Entire game`. Disable start-side buttons at
index 0, end-side at final. Map to lib fns: restart→`restartIndex`,
prevHalf→`prevHalfIndex`, prevQuarter→`prevQuarterIndex`, prev→`prevPlayIndex`,
next→`nextPlayIndex`, nextQuarter→`nextQuarterIndex`, nextHalf→`nextHalfIndex`,
entire→`entireGameIndex`.

Speed segmented `0.5× 1× 2× 4×` (mono labels). **Auto-sim**: when `playing`,
`setInterval(() => advance one play, 950 / speed)`; stop at final; changing speed
while playing restarts the interval; pressing play at final restarts from 0.
Clear the interval on unmount, on any manual step, and on mode change.

Progress/scrubber: **Review** → `<input type=range min=0 max=total value=idx>`
styled `.gc-scrub` (6px track `var(--surface-3)`, 16px `var(--text)` thumb with
`var(--bg)` ring); dragging sets `playIndex`. **Sim** → non-interactive progress
bar (`var(--text)` fill, `var(--accent)` when complete). Caption line:
`Play <idx> / <total>` + `Simulating`/`Complete`/`Drag to scrub`.

---

## Interactions & behavior
- Single source of truth: `playIndex`. All panels are pure functions of it.
- Clicking a **drive row** → jump to end of that drive. Clicking a **play row** →
  jump to that play. Both also implicitly pause auto-sim.
- Mode switch pauses auto-sim. Sim hides future plays/drives; Review reveals the
  whole game and enables the scrubber (default `playIndex = total`, i.e. Final).
- Auto-sim advances one play every `950/speed` ms; auto-scrolls play-by-play to
  the current play (`scrollIntoView({block:'nearest'})` on a sentinel — the
  existing `PlayList` already does this; keep it, and respect
  `prefers-reduced-motion` like `GamecastView` does today).
- Motion: DS-restrained. 120–200ms ease on hovers, progress width, drive-bar
  width. No entrance animations. The only looping animation is the LIVE dot.
- **Responsive** (target is desktop-first but responsive): below ~900px collapse
  the multi-column body to a single column (Field → Drive chart → Win prob →
  Play-by-play → stats), let controls wrap, keep the field SVG full-width. The
  mocks are shown at ~1180px desktop width.
- Empty/guard states already handled by `GamecastEmptyState` (`no_log`,
  `parse_error`) — keep them; the redesign only replaces the populated view.

## State management
Client component (`GamecastView`), `useState`:
- `playIndex: number` (0…plays.length)
- `mode: 'sim' | 'review'`
- `playing: boolean`
- `speed: 0.5 | 1 | 2 | 4`
Plus a `useRef` for the interval id. Derive `score`, `clock`, `isComplete`,
`driveSegments`, `groups`, `winProb`, `box`, `scoring`, `fieldGeometry` from
`playIndex` via the lib functions each render (memoize the series/heavy ones with
`useMemo` keyed on `log`). No new data fetching — the log is already loaded
server-side in `gamecast/page.tsx` and passed to `GamecastView`.

## Design tokens (from packages/design-system — use the variables, not literals)
- Surfaces: `--bg #0a0a0b` · `--surface #161618` · `--surface-2 #1d1d20` ·
  `--surface-3 #26262a` (light theme values in `tokens/colors.css`).
- Lines: `--border #2a2a2e` · `--border-strong #3a3a40`.
- Text: `--text #fafafa` · `--text-muted #9b9ba3` · `--text-subtle #67676f`.
- Primary (high-contrast): `--primary #fafafa` / `--primary-fg #0c0c0d` /
  `--primary-hover #e6e6e8`.
- Accent (green): `--accent #46c964` · `--accent-soft rgba(70,201,100,.16)`.
  (`data-accent` blue/violet/orange available.)
- Danger: `--danger #f2555c` · `--danger-strong #ff6166`.
- Radius: `--r 10px` (controls) · `--r-lg 14px` (cards); badges full pill.
- Spacing: 4px grid `--space-1…10`.
- Type: `--font-sans` Hanken Grotesk (400–800), `--font-mono` JetBrains Mono.
  Ramp in `tokens/typography.css` (display/stat/title/heading/body/label/
  caption/mono). Headings tracked -0.7…-1px.
- **Non-token content colors** (teams + field, intentionally outside the DS):
  Wheeler `#3d6fe6`, Hillgrove `#d1503a`, first-down gold `#e0b64a`, LOS blue
  `#4a9be0`, ball brown `#c47b3a`.

## Assets
No image assets. Icons are inline SVG in the DS `Icon` component style — add the
6 media-control glyphs listed under Controls. Brand trophy mark lives in
`packages/design-system/assets/` if you want it in a header.

## Files in this bundle
- `Gamecast.dc.html` — the interactive high-fidelity prototype (all 3 layouts on
  one canvas; toggle Sim/Review per option, step/scrub, auto-sim). Open in a
  browser. Its internal simulation engine is prototype-only — use your real
  `PbpGameLog`.
- `screens/1a-broadcast.png`, `screens/1b-fieldfirst.png`,
  `screens/1c-console.png` — reference screenshots.

## Target files in your repo
- `apps/web/src/components/gamecast/GamecastView.tsx` — rework to hold
  mode/playing/speed and compose the panels below.
- `…/GamecastScoreboard.tsx`, `…/DriveChart.tsx`, `…/PlayList.tsx`,
  `…/GamecastControls.tsx` — restyle/extend per specs.
- New: `…/FieldPosition.tsx`, `…/WinProbability.tsx`, `…/BoxScore.tsx`,
  `…/ScoringSummary.tsx`.
- `apps/web/src/lib/gamecast/` — add `prevPlayIndex`, `prevQuarterIndex`,
  `prevHalfIndex`, `winProbability*`, `boxScoreAtPosition`,
  `scoringSummaryAtPosition`; export from `index.ts`.
- `apps/web/e2e/tests/gamecast.spec.ts` — extend for prev/scrubber/mode/auto-sim.

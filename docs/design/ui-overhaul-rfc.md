# RFC: Professional UI Overhaul (Vercel / Convex aesthetic)

**Status:** Draft · **Owner:** Andrew · **Issue:** WSM-000136 (epic)
**Date:** 2026-06-14

## 1. Motivation

The app currently ships an **"8bit" pixel-retro theme** (warm cream "paper"
canvas, orange accent, chunky high-contrast pixel borders). It reads as playful,
not professional. For a product aimed at coaches/leagues evaluating us against
MaxPreps, we want the calm, credible, dense-but-clean look of **Vercel and
Convex**: a near-black canvas, hairline borders, restrained typography, one
accent, generous whitespace, and a signature **geographic visualization**
(Vercel's dot-matrix globe / regions list — a natural fit since teams are
inherently geographic).

Reference (operator-supplied screenshots): Vercel mobile dashboard — project
list cards, dark icon+label nav drawer, the **Regions globe** with a per-region
list, and a command palette.

## 2. Current state

- **Design system:** `src/components/ui/8bit/*` — 12 primitives (button, card,
  dialog, dropdown-menu, input, label, select, separator, skeleton, table,
  textarea) + `retro.css`. **~55 files import it.**
- **Tokens** (`globals.css`): light = cream `#f5e6d3` / orange `#d97757` /
  high-contrast pixel borders; dark = purple-black `#1a1a2e`.
- A parallel **base shadcn** set exists under `src/components/ui/*` (e.g.
  `input.tsx`) — useful migration target.
- **No map/globe/chart library** is installed.
- Visual-regression Playwright specs exist (`visual-regression.spec.ts`) — they
  will need rebaselining.

## 3. Design language (target)

**Principles:** dark-first, monochrome + one accent, hairline borders over
shadows, type and spacing do the work, motion is subtle and purposeful.

**Tokens (proposed):**
- Canvas `#0a0a0a` / elevated surface `#111`, card `#0f0f0f`; borders
  `#1f1f1f`–`#262626` (hairline, ~1px).
- Text: foreground `#ededed`, muted `#a1a1a1`, faint `#ededed/40`.
- One accent (keep a sport-forward hue — refined orange or shift to Vercel-blue;
  decision below). Semantic green/red/amber for status only.
- Radius: `8–10px` (md), `6px` (sm). Elevation: borders + faint inner glow, not
  drop shadows.
- Type: a Geist-like grotesk (`Geist`/`Inter`) + `Geist Mono` for numbers/IDs.
- Light theme: retained but secondary (Vercel ships both); ship dark first.

## 4. Component strategy

Re-skin to a clean shadcn baseline and **retire 8bit**:
1. Define the new tokens in `globals.css` (+ a `theme` mapping).
2. Build/restyle the base primitives under `src/components/ui/*` to the new
   tokens (button, card, input, select, dialog, table, badge, tabs, command,
   sheet, dropdown, skeleton, separator, tooltip).
3. **Migrate the 55 importers** from `ui/8bit/*` → `ui/*` (codemod the import
   paths; APIs are near-identical). Delete `ui/8bit/*` + `retro.css` at the end.
4. Lock primitives with a Storybook-less "kitchen sink" route (`/dev/ui`) for
   visual review, and rebaseline the Playwright visual specs.

## 5. Navigation shell

Vercel-style: dark sidebar with **icon + label** grouped sections, a top
**breadcrumb / context switcher** (org → league) with a status dot, and a
**command palette (⌘K / "Find…")** for jump-to. Mobile drawer already exists
(WSM-000085) — restyle it. Composes with the league switcher (WSM-000103).

## 6. Signature visual — League Map / Regions

The thing you love about Vercel. Two complementary pieces:
- **League map** (utility): teams plotted by `city`/`location` on a US/regional
  map with hover cards and a side list (mirroring Vercel's region list, e.g.
  team count per metro). Best fit for HS football's geography.
- **Globe hero** (marketing/landing, optional): a `cobe` dot-globe on the public
  landing / league public page for credibility.

**Tech options:** `cobe` (~5kb WebGL dot globe, exactly Vercel's), or
`react-simple-maps`/`d3-geo` (SVG US map, lighter, more controllable),
or `maplibre-gl` (full interactive map, heavier). Recommend **map = react-simple-maps**
for the dashboard + **cobe** for the optional globe hero. Requires team
lat/long (geocode from city, or store coordinates) — a small data task.

## 6.5 Signature visual — Coach / Admin "bento" dashboard

The home/overview as a **bento grid of widgets** (operator reference: a dark,
monospace, data-dense dashboard — hero status card, radial gauges, a
contributions heatmap, a streak counter, a sparkline, and a live activity feed).
Mapped to sports:
- **Hero card** — league + active season, week N, next kickoff countdown.
- **Radial gauges** — roster fill (active/limit), avg team SPRT, schedule
  completion %.
- **Contributions heatmap** — activity over the season (roster moves / games
  recorded / attribute ingests per day) — the GitHub-style green grid.
- **Streak / standings snapshot** — top teams, current streak.
- **Sparkline** — a trend (e.g. scoring or roster changes over weeks).
- **Activity feed** — recent roster moves, results, member changes (reads from
  `rosterAuditLog` + `gameResults`), styled like a deploy/activity log.

Role-aware: an **admin** sees league-wide + member/org widgets; a **coach** sees
their team(s). Built on the new primitives; widgets are independent cards that
degrade gracefully when a data source is empty (e.g. no season yet).

## 7. Phasing (each phase is a shippable PR)

1. **Tokens + primitives** — new tokens, restyle base components, `/dev/ui` sink,
   rebaseline visual specs. (No page logic changes.)
2. **Shell + nav** — sidebar, breadcrumb/switcher, command palette, mobile drawer.
3. **Core pages** — leagues (pairs with accordion redesign WSM-000132), teams,
   players, roster, depth chart, standings.
4. **Coach/Admin bento dashboard** (§6.5) — role-aware widget grid as the home.
5. **Geo visual** — league map + regions list; optional globe hero.
6. **Migrate + delete 8bit** — finish import codemod, remove `ui/8bit/*`,
   `retro.css`, retro tokens.
7. **Polish** — empty states, loading skeletons, motion, a11y/contrast audit.

## 8. Risks & constraints

- **Scope:** 55 importers — do it incrementally behind a stable primitive API,
  not a big-bang.
- **Visual regression:** existing screenshot specs must be rebaselined per phase.
- **Perf:** globe/map add bundle weight — lazy-load, route-split, keep off the
  critical path.
- **Accessibility:** dark theme contrast (WCAG AA), focus states, the
  ≥16px-input mobile rule (WSM-000085) carries over.
- **Data:** team coordinates needed for the map (geocode/store) — scope into
  phase 4.

## 9. Decisions to confirm

1. **Accent:** keep a refined sport-orange, or move to Vercel-blue / monochrome?
2. **Themes:** dark-only, or dark-first with light retained?
3. **Geo:** dashboard **map** + optional **globe** hero — or globe only?
4. **8bit:** full replacement (recommended) vs. keep as a selectable theme?

## 10. Out of scope (separate tracks)

Feature work already queued (seasons, scheduling, divisions, branding, imports)
proceeds independently; this RFC is purely the visual/system layer and the
shell. Team branding (WSM-000134) and the leagues accordion (WSM-000132) should
land *on top of* the new primitives where timing allows.

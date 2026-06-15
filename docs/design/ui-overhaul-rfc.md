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
- **Monochrome** — no brand accent. The UI is white/gray on near-black; color is
  reserved for **semantic status only** (green/red/amber). Interactive emphasis
  comes from contrast/weight, not hue. (Decision §9.1.)
- Radius: `8–10px` (md), `6px` (sm). Elevation: borders + faint inner glow, not
  drop shadows.
- Type: a Geist-like grotesk (`Geist`/`Inter`) + `Geist Mono` for numbers/IDs.
- Light theme: retained but secondary (Vercel ships both); ship dark first.

## 4. Component strategy

**Lean on shadcn/ui (https://ui.shadcn.com) as the baseline — install from the
registry, extend/compose only when a need isn't met. Do not hand-roll what the
registry already provides.** Then **retire 8bit**:
1. Define the new monochrome tokens in `globals.css` (+ a `theme` mapping). Since
   shadcn is token-driven (CSS variables), the look comes almost entirely from
   tokens — minimal per-component overrides.
2. Pull the needed primitives via the shadcn CLI (`npx shadcn@latest add …`):
   button, card, input, select, dialog, table, badge, tabs, command, sheet,
   dropdown-menu, skeleton, separator, tooltip, sonner, accordion, popover,
   scroll-area. They land under `src/components/ui/*` as editable source we own.
3. **Extend, don't fork:** wrap/compose for app-specific needs (e.g. the
   `DataTable`, status badges, role chips) rather than re-implementing the base.
   New bespoke pieces (bento widgets, map, globe) compose these primitives.
4. **Migrate the 55 importers** from `ui/8bit/*` → `ui/*` (codemod the import
   paths; APIs are near-identical). Delete `ui/8bit/*` + `retro.css` at the end.
5. Lock primitives with a "kitchen sink" route (`/dev/ui`) for visual review, and
   rebaseline the Playwright visual specs.

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

## 9. Decisions (resolved 2026-06-14)

1. **Accent → Monochrome + status only.** White/gray on near-black; no brand
   hue. Color is reserved for semantic status (green/red/amber). Emphasis via
   contrast and weight, not color.
2. **Themes → Dark-first, light retained.** Dark is the default and the design
   target; a working light theme is kept (tokens defined for both).
3. **Geo → Map + optional globe.** A dashboard league **map** (teams by metro +
   regions list) is the utility piece; a `cobe` **globe** hero is optional on the
   public/landing page.
4. **8bit → Full replacement.** Retire `ui/8bit/*` + `retro.css` + retro tokens;
   migrate all ~55 importers to the new primitives.

## 10. Out of scope (separate tracks)

Feature work already queued (seasons, scheduling, divisions, branding, imports)
proceeds independently; this RFC is purely the visual/system layer and the
shell. Team branding (WSM-000134) and the leagues accordion (WSM-000132) should
land *on top of* the new primitives where timing allows.

## 11. Scoping update — code audit (2026-06-15)

A full audit of the current code (before starting P1) found the **8bit-migration
premise is largely already resolved**, which significantly re-sizes the epic.
Verified facts:

- **No `ui/8bit/*` directory. Zero imports from `8bit`. No `retro.css`.** (§2's
  "~55 importers / delete ui/8bit + retro.css" describes a state that no longer
  exists — the token migration was already done.)
- The app already runs **`src/components/ui/*` shadcn primitives** (16: accordion,
  alert-dialog, badge, button, card, dialog, dropdown-menu, input, label, select,
  separator, sheet, skeleton, table, textarea, tooltip).
- Tokens in `globals.css` are **already monochrome dark** (oklch, all hue 0 except
  a red `destructive`) and **dark-first** (`<html className="dark">`); a light
  token set is defined. This *is* the §3 target, modulo fine-tuning the ramp.
- Fonts are already **Geist + Geist Mono** (the §3 target typeface).
- Sidebar + mobile drawer are already token-driven and **not retro**.

**Actual 8bit residue (trivial):** one `@8bitcn` registry line in
`components.json`; the `Pixelify_Sans` font in `layout.tsx`; and `PixelLineChart`
(used by 2 player-development pages + 1 visual harness, with 4 Playwright
baselines). That's the entire "migration" — folds into P1, not its own phase.

**Missing deps for the net-new work:** `next-themes` (toggle), `cmdk` (palette),
a chart lib e.g. `recharts` (bento), `react-simple-maps` + `cobe` (geo) — all
absent. **Teams have no `lat`/`lng`** (only text `city`/`location`), so the map
(P5) carries a real data prerequisite.

### Re-sized phase plan

The work is **mostly polish + net-new signature features**, not a migration:

| Phase | Re-scoped reality | Size |
| --- | --- | --- |
| **P1 — Tokens, theme toggle, de-retro, kitchen sink** | Tune the existing oklch ramp to §3; add `next-themes` + a light/dark toggle (light tokens exist, no toggle yet); remove `@8bitcn` line; decide `PixelLineChart` (restyle monochrome) + Pixelify font; flesh out `/dev/ui`; rebaseline the 4 visual snapshots. Absorbs the old **P6** (nothing to delete). | **S** |
| **P2 — Command palette + breadcrumb** | Net-new: install `cmdk`, build ⌘K jump-to; add a breadcrumb/context switcher with status dot. Sidebar/drawer already fine (light restyle only). | **M** |
| **P3 — Core-page density pass** | A visual refresh (hairline borders, spacing, mono numerals) across ~24 dashboard pages + ~72 `ui/*` importers — **not** a re-theme. Pairs with accordion #250. | **M** |
| **P4 — Bento dashboard** | Net-new role-aware widget grid; needs a chart approach (hand-rolled SVG or `recharts`); activity feed reads `rosterAuditLog` + `gameResults`. Biggest feature. | **L** |
| **P5 — Geo map** | Net-new **and data-blocked**: add `lat`/`lng` to the teams schema + geocode + seed (sub-task), then `react-simple-maps` map + optional `cobe` globe. | **L** |
| **P6 — (removed)** | No standalone migration; the trivial residue folds into P1. | — |
| **P7 — Polish** | Empty states, skeletons (exist), motion (`framer-motion`), a11y/contrast AA, ≥16px mobile inputs (#185). | **S–M** |

**Recommended sequence:** P1 (small, low-risk, rebaselines specs and lands the
toggle) → P2 (first visible "Vercel feel" win) → P3 (density polish) → P4 (bento)
→ P5 (map; do its data sub-task first) → P7 (polish). Each remains an independent,
shippable PR. The dominant "migration" effort in the original framing is ~zero.

> Decision §9.4 ("retire `ui/8bit/*` + `retro.css`") is **moot** — those don't
> exist. Restated: the only cleanup is the `@8bitcn` line + Pixelify/PixelLineChart,
> folded into P1.

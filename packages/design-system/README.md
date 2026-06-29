# Sports League — Design System

A token-driven design system for **Sports League**, a league-management
platform where operators import leagues, build rosters and divisions, run
seasons, and sync live data. The product is a dense, keyboard-friendly
dashboard with a high-contrast aesthetic and a single live-data accent.

This system was derived from the product's dashboard UI (Discover, Teams,
Seasons, Import flows). It ships tokens, a React component library, foundation
specimens, and a Dashboard UI kit. There is no external Figma or repo bound to
this system — it is self-contained in this project.

---

## Content fundamentals

How the product writes copy:

- **Voice: direct and operational.** Labels are imperative verbs —
  "New Season", "Add all (32)", "Start Import", "Make active". Buttons say what
  they do.
- **Second person, implied.** UI speaks to the operator ("Browse leagues and
  add teams to your dashboard"). Rarely "we".
- **Sentence case everywhere** except small uppercase mono labels (stat labels,
  table headers, eyebrows). Never Title Case On Buttons.
- **Numbers are first-class.** Counts ride alongside nouns — "413 Teams",
  "AFC East (4)", "0 / 2929 Players". Use the mono font and tabular figures.
- **Terse system feedback.** "Last sync complete · 2,929 players updated",
  "Sync failed", "Build failed. Bundle exceeds 50 MB." A status, then an
  optional muted clause.
- **No emoji, no exclamation.** Tone is a calm operator console, not a
  consumer app. Iconography carries warmth, not punctuation.

---

## Visual foundations

- **Two themes, one token set.** Dark is primary (near-black `#0a0a0b`
  canvas, `#161618` cards). Light is a clean off-white (`#fbfbfc` / `#fff`).
  Components never hard-code color — they read semantic CSS variables, and the
  active theme is chosen by a `data-theme` attribute on a `.sl-root` wrapper.
- **High-contrast primary action.** The primary button/active-nav fill is the
  *opposite* of the canvas: near-white on dark, near-black on light
  (`--primary` / `--primary-fg`). This is the signature move — it reads as
  crisp and editorial rather than colorful.
- **One accent, for life/data.** A single green (`--accent`) marks success,
  "added", "active", and live totals — never decoration. It has a soft
  translucent companion (`--accent-soft`) for badge/banner backgrounds. The
  accent is an independent axis (`data-accent`: green default, blue, violet,
  orange).
- **Hierarchy from tone + border first, shadow last.** Surfaces step
  `bg → surface → surface-2 → surface-3`; hairline borders (`--border`,
  `--border-strong`) separate. Shadows are reserved for true overlays
  (menus, dialogs, toasts) via `--shadow`.
- **Text in three ranks:** `--text` (primary), `--text-muted` (secondary),
  `--text-subtle` (hint/placeholder/disabled). Don't introduce more.
- **Type:** Hanken Grotesk for everything UI + prose (400–800), JetBrains Mono
  for data, keys, paths, and stat/table numerals. Headings are tight-tracked
  (`-0.7px` to `-1px`); body is 14–15px with generous line-height.
- **Shape:** a 4px spacing grid (`--space-1…10`) and a two-step radius —
  `--r` for controls (10px), `--r-lg` for cards (14px) — plus full pills for
  badges. Radius is its own axis (`data-round`: sharp / default / soft).
- **Borders over fills.** Inputs, secondary buttons, chips, and cards are
  defined by 1px borders on subtle surfaces, not heavy fills.
- **Focus:** a 3px soft ring (`--ring`) on focus-visible; inputs also darken
  their border to `--text`.
- **Motion:** restrained. 120–150ms ease on background/border/transform for
  hovers and the switch knob. No bounce, no large entrance animations.
- **Hover/press:** secondary surfaces lighten one step (`surface-2 →
  surface-3`); primary shifts to `--primary-hover`; ghost items gain a
  `surface-2` wash. Danger brightens slightly.
- **Cards:** `--surface` background, 1px `--border`, `--r-lg` radius, little or
  no shadow. Dashed `--border-strong` for empty/drop states.

---

## Iconography

- **Lucide-style line icons** on a 24px grid, ~1.9 stroke, round caps/joins,
  drawn with `currentColor` so they inherit text color. Implemented as the
  `Icon` component (`components/icon/`) with a named set — no icon font, no PNG
  sprites.
- Icons are **monochrome and functional**: nav glyphs, status checks, chevrons,
  search, theme toggle, row actions (pencil/trash). The accent color is applied
  to check/added states only.
- The brand glyph is a **trophy** on a `--primary` tile (radius 9). Wordmark is
  "Sports League" in Hanken Grotesk 700, `-0.5px` tracking.
- **No emoji or unicode-as-icon.** If you need a glyph the set lacks, add it to
  `Icon` rather than reaching for an emoji.
- *Substitution note:* icons are hand-paths in the Lucide visual style (not the
  Lucide package). If you adopt the npm Lucide set later, the look matches.

---

## Index / manifest

```
styles.css                  global entry — link this one file
tokens/
  fonts.css                 webfont import (Hanken Grotesk, JetBrains Mono)
  colors.css                theme + accent tokens
  typography.css            font + type-ramp tokens
  spacing.css               4px grid + radius tokens
  components.css            component classes (.sl-*)
components/
  icon/        Icon
  forms/       Button, IconButton, Input, Select, Search, Switch, Checkbox, Radio
  data/        Badge, Card, Stat, Avatar, Table
  navigation/  NavItem, Tabs, Segmented, Breadcrumb, PageHeader
  feedback/    Banner
guidelines/                 foundation specimen cards (Colors, Type, Spacing, Brand)
ui_kits/dashboard/          Discover screen — index.html (interactive) + DiscoverScreen.jsx
react/                      stand-alone npm-style package mirror (tokens.css + src/)
SKILL.md                    Agent-Skill manifest
```

**Components** (19): Icon · Button · IconButton · Input · Select · Search ·
Switch · Checkbox · Radio · Badge · Card · Stat · Avatar · Table · NavItem ·
Tabs · Segmented · Breadcrumb · PageHeader · Banner.

**UI kits** (1): Dashboard — the Discover view.

### Consuming the system

Link the stylesheet once, then wrap your app in a `.sl-root` with theme
attributes (or use the `ThemeProvider` in `react/src/theme.tsx`):

```html
<link rel="stylesheet" href="styles.css">
<div class="sl-root" data-theme="dark" data-accent="green" data-round="default">
  <!-- components here -->
</div>
```

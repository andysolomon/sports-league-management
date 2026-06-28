---
name: sports-league-design
description: Use this skill to generate well-branded interfaces and assets for Sports League, a league-management dashboard platform, for production code or throwaway prototypes/mocks. Contains the full token system (light + dark), typography, components, voice, and a UI kit for prototyping.
user-invocable: true
version: 1.0
system-name: Sports League
themes: dark (default), light
fonts:
  sans: Hanken Grotesk
  mono: JetBrains Mono
colors-dark:
  bg: "#0a0a0b"
  surface: "#161618"
  surface-2: "#1d1d20"
  surface-3: "#26262a"
  border: "#2a2a2e"
  border-strong: "#3a3a40"
  text: "#fafafa"
  text-muted: "#9b9ba3"
  text-subtle: "#67676f"
  primary: "#fafafa"
  primary-fg: "#0c0c0d"
  primary-hover: "#e6e6e8"
  danger: "#f2555c"
  danger-strong: "#ff6166"
  ring: "rgba(250,250,250,0.20)"
  shadow: "0 16px 40px rgba(0,0,0,0.60)"
  accent: "#46c964"
  accent-soft: "rgba(70,201,100,0.16)"
colors-light:
  bg: "#fbfbfc"
  surface: "#ffffff"
  surface-2: "#f4f4f5"
  surface-3: "#eaeaec"
  border: "#e6e6e9"
  border-strong: "#d6d6da"
  text: "#0c0c0d"
  text-muted: "#5b5b61"
  text-subtle: "#9a9aa1"
  primary: "#0c0c0d"
  primary-fg: "#ffffff"
  primary-hover: "#2a2a2e"
  danger: "#dc2626"
  danger-strong: "#e5484d"
  ring: "rgba(12,12,13,0.15)"
  shadow: "0 12px 30px rgba(0,0,0,0.13)"
  accent: "#18a558"
  accent-soft: "rgba(24,165,88,0.10)"
colors-accent:
  # accent axis — [data-accent]; first value dark, second light
  green: ["#46c964", "#18a558"]
  blue: ["#5b8dff", "#2563eb"]
  violet: ["#a17bff", "#7c3aed"]
  orange: ["#ff9e4a", "#d9730a"]
typography:
  display-32: { fontFamily: Hanken Grotesk, fontSize: 32px, fontWeight: 700, lineHeight: 38px, letterSpacing: -1px }
  stat-30:    { fontFamily: Hanken Grotesk, fontSize: 30px, fontWeight: 700, lineHeight: 32px, letterSpacing: -0.6px }
  title-22:   { fontFamily: Hanken Grotesk, fontSize: 22px, fontWeight: 700, lineHeight: 28px, letterSpacing: -0.4px }
  heading-18: { fontFamily: Hanken Grotesk, fontSize: 18px, fontWeight: 600, lineHeight: 24px }
  body-15:    { fontFamily: Hanken Grotesk, fontSize: 15px, fontWeight: 400, lineHeight: 23px }
  label-14:   { fontFamily: Hanken Grotesk, fontSize: 14px, fontWeight: 500, lineHeight: 20px }
  caption-12: { fontFamily: Hanken Grotesk, fontSize: 12px, fontWeight: 500, lineHeight: 16px }
  mono-13:    { fontFamily: JetBrains Mono, fontSize: 13px, fontWeight: 500, lineHeight: 18px }
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  10: 40px
  base: 4px
rounded:
  # [data-round]: default / sharp / soft
  control: { default: 10px, sharp: 6px, soft: 14px }   # --r
  card:    { default: 14px, sharp: 9px, soft: 20px }   # --r-lg
  pill: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    typography: "{typography.label-14}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: 38px
    hover: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    border: "1px solid {colors.border-strong}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: 38px
    hover: "{colors.surface-3}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.text-muted}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: 38px
    hover: "{colors.surface-2}"
  button-danger:
    backgroundColor: "{colors.danger-strong}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: 38px
  button-sm: { height: 32px, padding: "0 11px", typography: "{typography.caption-12}" }
  button-lg: { height: 44px, padding: "0 18px" }
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: 38px
    focus: "border {colors.text}; box-shadow 0 0 0 3px {colors.ring}"
  badge:
    rounded: "{rounded.pill}"
    height: 24px
    padding: "0 10px"
    typography: "{typography.caption-12}"
  card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.card}"
    padding: "18px"
---

# Sports League

## Overview

Sports League is a league-management platform — operators import leagues, build rosters and divisions, run seasons, and sync live data. The aesthetic is a dense, keyboard-friendly **operator console**: near-neutral surfaces, a high-contrast primary action, and a single accent reserved for live data. It is **dual-theme** — dark is the default, light is a clean off-white — and both themes share one set of semantic token names. Prioritize readability, scannable numbers, and accessibility; use color to signal state and one important action, never decoration.

The runtime picks a theme with attributes on a `.sl-root` wrapper: `data-theme` (`dark` | `light`), `data-accent` (`green` | `blue` | `violet` | `orange`), `data-round` (`sharp` | `default` | `soft`). Every component reads CSS variables off that wrapper. Link `styles.css` once; it pulls in `tokens/` (fonts, colors, typography, spacing, component classes).

## Colors

Tokens are **semantic, not literal** — components reference the name (`--surface`, `--text-muted`, `--accent`), never the hex, so the same markup re-themes by swapping `data-theme`. Both theme tables are in the frontmatter (`colors-dark`, `colors-light`).

Roles:

- **Surfaces** step in four tones: `--bg` (app canvas) → `--surface` (cards) → `--surface-2` (inset / secondary fill, hover) → `--surface-3` (pressed / stronger fill). Don't introduce surfaces between these.
- **Borders**: `--border` is the hairline that separates surfaces; `--border-strong` is the control/interactive border.
- **Text in three ranks**: `--text` (primary), `--text-muted` (secondary, captions, labels), `--text-subtle` (hint, placeholder, disabled). Never add a fourth rank.
- **Primary action**: `--primary` / `--primary-fg` is the signature high-contrast pair — near-white on dark, near-black on light. It is the *inverse* of the canvas, which reads crisp and editorial. `--primary-hover` is its hover.
- **Accent** (`--accent`, `--accent-soft`): one color, reserved for **live data, success, "added", "active", and key totals** — never decoration. `--accent-soft` is its translucent companion for badge/banner fills. The accent is an independent axis (`data-accent`), so green can become blue/violet/orange without touching any other token.
- **Danger** (`--danger`, `--danger-strong`): destructive actions and error states only.

## Typography

Hanken Grotesk sets all UI and prose; JetBrains Mono sets data, keyboard keys, paths, and tabular numerals. The `typography` tokens carry concrete `fontFamily`, `fontSize`, `fontWeight`, `lineHeight` (and tracking on the big sizes):

- `display-32` / `stat-30` — page heroes and big KPI numbers; tight tracking.
- `title-22` / `heading-18` — card titles and section heads.
- `body-15` — default multi-line prose (`--text-muted` for supporting copy).
- `label-14` — controls, nav, form labels, single-line UI text.
- `caption-12` — metadata, small uppercase labels (`letter-spacing:.5px; text-transform:uppercase` for stat labels and table headers).
- `mono-13` — paths, keys, and any figures that must align. Prefer tabular figures for stats and tables.

Apply the tokens (or the `--font-sans` / `--font-mono` + ramp variables) rather than setting size/weight/tracking by hand. Headings use 700–800; never run more than two weights in one view.

## Layout

Spacing is a **4px grid**: 4, 8, 12, 16, 20, 24, 32, 40px (`--space-1…10`). Keep a three-step rhythm — 8px inside a group, 16px between groups, 24–40px between sections. Cards use 18px padding (compact) up to 24px. Center primary content in a ~1180px column with 24–32px side padding. The app shell is a fixed ~200px sidebar + a 54–56px top bar over a scrolling content area. Every layout should hold up from mobile to desktop.

## Elevation & Depth

Hierarchy comes from **tonal surfaces and borders first**, so shadows stay reserved for true overlays. Use `--shadow` (dark: `0 16px 40px rgba(0,0,0,.60)`, light: `0 12px 30px rgba(0,0,0,.13)`) on menus, dialogs, and toasts. Cards take little or no shadow — a 1px `--border` and `--surface` fill do the separating. Empty/drop states use a dashed `--border-strong`. Pair every elevated surface with the card radius (`--r-lg`).

## Motion

Restrained and physical. Most state changes are 120–150ms ease on `background`, `border-color`, and `transform` (button hovers, the switch knob, accordion chevrons). Overlays fade/scale in ~200ms. No bounce, no looping or attention-grabbing animation, no large entrance effects. Honor `prefers-reduced-motion` by dropping nonessential motion.

## Shapes

Two control radii plus a pill, exposed as an axis (`data-round`): `--r` for controls (default 10px) and `--r-lg` for cards (default 14px); `sharp` tightens them to 6/9px, `soft` opens them to 14/20px. Reserve `9999px` for badges, avatars, and circular controls. Keep one radius family per view — don't mix rounded and sharp.

## Components

19 primitives ship as React (`components/<group>/<Name>.jsx` + `.d.ts` + `.prompt.md`) and as CSS classes (`.sl-*` in `tokens/components.css`). The `components` frontmatter gives ready values per element.

- **Button** — `primary` (high-contrast, the single most important action per view), `secondary` (bordered surface-2), `ghost` (text), `danger` (solid danger). Sizes `sm` 32 / `md` 38 / `lg` 44px. Optional leading icon.
- **IconButton** — 34px square, bordered ghost; always give an `aria-label`.
- **Input / Select / Search** — `--surface` fill, 1px `--border`; focus darkens the border to `--text` and adds a 3px `--ring`. Search carries a leading magnifier and a `⌘K` chip.
- **Switch / Checkbox / Radio** — Switch track turns `--accent` when on; Checkbox fills `--primary`; Radio ring fills `--accent`.
- **Badge** — pill; variants `outline` / `neutral` / `solid` / `success` (accent-soft) / `danger`; optional dot or icon.
- **Card / Stat / Avatar / Table** — Stat is a big number over an uppercase caption (`accent` for live totals); Avatar falls back to initials on accent-soft; Table uses mono uppercase headers.
- **NavItem / Tabs / Segmented / Breadcrumb / PageHeader** — NavItem active state is the `--primary` fill; exactly one active. Segmented is the inline pill toggle; Tabs is the underline bar.
- **Banner** — inline feedback; `success` (accent-soft) or `danger` (danger border), each with a leading status icon.

States: secondary surfaces lighten one step on hover (`surface-2 → surface-3`); primary shifts to `--primary-hover`; ghost gains a `surface-2` wash; danger brightens. Disabled uses a `surface-2` fill, `text-subtle` text, and a not-allowed cursor. Focus shows the 3px `--ring` at `:focus-visible`.

## Iconography

**Lucide-style line icons** on a 24px grid, ~1.9 stroke, round caps/joins, drawn with `currentColor` so they inherit text color. Implemented as the `Icon` component (`components/icon/`) with a named set — no icon font, no PNG sprites. Icons are monochrome and functional (nav glyphs, status checks, chevrons, search, theme toggle, row pencil/trash); the accent color is applied only to check/added states. The brand glyph is a **trophy** on a `--primary` tile (radius 9); the wordmark is "Sports League" in Hanken Grotesk 700, `-0.5px` tracking. No emoji, no unicode-as-icon — extend the `Icon` set instead.

## Voice & Content

Copy is part of the design; keep it precise and operational.

- **Sentence case** for everything except small uppercase mono labels (stat labels, table headers, eyebrows). Never Title Case On Buttons.
- **Name actions with a verb (+ noun):** `New Season`, `Add all (32)`, `Start Import`, `Make active` — never `Confirm`, `OK`, or a bare label.
- **Second person, implied.** UI speaks to the operator: "Browse leagues and add teams to your dashboard." Rarely "we".
- **Numbers are first-class** and ride with the noun — `413 Teams`, `AFC East (4)`, `0 / 2929 Players` — set in the mono font with tabular figures.
- **Errors = what happened + what to do:** `Build failed. Bundle exceeds 50 MB. Reduce it or raise the limit.`
- **Status feedback is terse**, no trailing period, never "successfully": `Last sync complete · 2,929 players updated`, `Sync failed`.
- **Empty states point to the first action:** `No players yet. Add players to build the roster.`
- **In-progress** uses the present participle + ellipsis: `Syncing…`, `Importing…`. No emoji, no exclamation, no marketing superlatives.

## Do's and Don'ts

- Rank information with the three text tokens: `--text` primary, `--text-muted` secondary, `--text-subtle` hint/disabled.
- Keep the accent for live data, success, and the one most important action on a view.
- Build hierarchy with surface tone + 1px borders before reaching for shadow.
- Hold WCAG AA contrast (4.5:1 for body text); pair any state color with an icon or text label — never color alone.
- Show the `--ring` focus on every interactive element at `:focus-visible`; never remove an outline without a visible replacement.
- Apply the typography tokens instead of setting font size, weight, or tracking by hand.
- Don't add a fourth text rank or a surface tone between the four defined ones.
- Don't use the accent decoratively, and don't introduce a second accent in one view.
- Don't mix rounded and sharp radii, or more than two font weights, in one view.
- Don't hard-code hex — reference the semantic token so both themes resolve.

## Using this system

- **Files:** `styles.css` (link this one) → `tokens/` (fonts, colors, typography, spacing, components). `components/` (React: icon, forms, data, navigation, feedback). `guidelines/` (foundation specimen cards). `ui_kits/dashboard/` (the interactive Discover screen + `DiscoverScreen.jsx`). `readme.md` (full design guide).
- **HTML artifacts** (slides, mocks, prototypes): copy assets out, link `styles.css`, and wrap content in `<div class="sl-root" data-theme="dark" data-accent="green">…</div>` so tokens resolve. Use the `.sl-*` classes or copy the components.
- **Production React:** copy `components/` (or the mirror in `react/`), import `styles.css`, and wrap the app in the `ThemeProvider` (`react/src/theme.tsx`) or a `.sl-root` with the data attributes.
- If invoked with no other guidance, ask what the user wants to build, ask a few questions, and act as an expert designer who outputs HTML artifacts **or** production code as needed.

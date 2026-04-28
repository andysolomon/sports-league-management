# Sprint 3 — 8-bit Re-skin Close-Out

> **Sprint:** 2026-04-28 (single-day burst)
> **Companion docs:** [SPRINT_3_VERIFICATION.md](./SPRINT_3_VERIFICATION.md) — criteria matrix + locked decisions
> **Stories shipped:** WSM-000026..WSM-000036 (11 stories, 10 PRs after combining the e2e-sweep + closeout)
> **Anchor library:** [8bitcn/ui](https://www.8bitcn.com) on shadcn/ui + Tailwind v4 + Geist + Pixelify Sans

Sprint 3 swaps the entire app aesthetic from shadcn-modern to 8-bit indie pixel-art (Stardew/Celeste-leaning, modern palette, crisp 0px-radius pixel borders, Pixelify Sans display + Geist body). Bypasses Phase 2 (player attributes), which moves to Sprint 4 already native to the new aesthetic.

Per-story implementation notes below.

---

## WSM-000026 — Foundation: 8bitcn registry

**PR:** #131

### Files touched
- `apps/web/components.json` (new — repo had no shadcn config previously)
- `apps/web/src/components/ui/8bit/button.tsx` (smoke install)
- `apps/web/src/components/ui/8bit/retro.css` (bundled by 8bitcn)

### Key decisions
- Created `components.json` from scratch — the repo had shadcn-flavored components but no CLI config. The shadcn CLI auto-added the `@8bitcn` registry block on first install.
- Smoke-installed Button to verify the pipeline. Discovered that **8bit components wrap shadcn ones**: `import { Button as ShadcnButton } from "@/components/ui/button"`. Both layers stay forever — re-skin is "swap consumer imports", not "replace components".
- Lands in `src/components/ui/8bit/` (sibling subdirectory) via `--path` flag.

---

## WSM-000027 — Design tokens

**PR:** #132

### Files touched
- `apps/web/src/app/globals.css`

### Key decisions
- Replaced minimal `--color-primary` + `--color-primary-foreground` with full shadcn-compatible token surface (background, card, popover, primary, secondary, muted, accent, destructive, border, input, ring — each with `*-foreground`).
- Light: warm cream paper (`#f5e6d3`) + deep purple-black + warm orange primary. Dark: deep night blue-purple (`#1a1a2e`) + cream foreground + vivid orange.
- Radii to 0px (chunky pixel edges); `--radius-xl` reserved at 4px.
- Added opt-in `.scanlines` class (CRT overlay via `repeating-linear-gradient`).
- Tightened `.skip-to-content` to use new tokens with a 2px crisp border.

---

## WSM-000028 — Typography

**PR:** #133

### Files touched
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/package.json` (added `geist`)

### Key decisions
- Three font roles: `--font-sans` → Geist Sans, `--font-mono` → Geist Mono, `--font-display` → Pixelify Sans.
- All `h1-h6` inherit `--font-display` globally — no per-component opt-in required.
- Override the `.retro` class shipped by 8bitcn `retro.css` so it uses `--font-display` (Pixelify Sans) instead of pulling Press Start 2P off Google Fonts via `@import`. Keeps the external `@import` off the critical path.
- Dropped Inter (was unused after WSM-000027 token cleanup quietly disconnected `--font-sans` from it).

---

## WSM-000029 — Form primitives install

**PR:** #134

### Files touched
- `apps/web/src/components/ui/8bit/{input,label,textarea}.tsx`

### Key decisions
- Pure install — Button was already in from WSM-000026. No consumers wired yet.
- Each install creates a wrapper file that delegates to the corresponding `@/components/ui/<name>` shadcn primitive.

---

## WSM-000030 — Overlay primitives install

**PR:** #135

### Files touched
- `apps/web/src/components/ui/8bit/{dialog,dropdown-menu,select}.tsx`
- `apps/web/src/components/ui/{dialog,dropdown-menu,select,tooltip}.tsx` (canonical re-install)

### Key decisions
- Pre-existing slim shadcn ports were missing exports the 8bit wrappers expected (`DialogFooter`, `DropdownMenuLabel/Group/Sub/Portal/Shortcut/CheckboxItem`, `SelectLabel/Separator/ScrollUp+DownButton`). Re-installed the canonical shadcn variants to bring API surface to current. No semantic change for existing consumers.
- **Tooltip (8bit) skipped:** upstream 8bitcn type bug — `BitTooltipContentProps` recursively references itself via `React.ComponentPropsWithoutRef<typeof ShadcnTooltipContent>`. Shadcn tooltip primitive added for future use; 8bit variant deferred.
- **Sonner (8bit) skipped:** not in registry (`/r/sonner.json` → 404). Existing `sonner` Toaster in `layout.tsx` stays.

---

## WSM-000031 — Display primitives install

**PR:** #136

### Files touched
- `apps/web/src/components/ui/8bit/{card,table,skeleton,separator}.tsx`
- `apps/web/src/components/ui/{card,table}.tsx` (canonical re-install)

### Key decisions
- Same canonical-re-install dance for Card and Table (missing `CardAction`, `CardFooter`, `TableCaption`, `TableFooter`).
- **Badge (8bit) skipped:** re-installing canonical shadcn badge would drop the project-local `success` and `warning` variants used by `status-badge.tsx`. Kept the slim local badge; reconciliation deferred.
- **Tabs (8bit) skipped:** same recursive-type bug as Tooltip.

---

## WSM-000032 — Dashboard chrome + marketing swaps

**PR:** #137

### Files touched
- `apps/web/src/app/dashboard/_components/mobile-header.tsx`
- `apps/web/src/components/marketing/{header,hero,features}.tsx`

### Key decisions
- **First story to swap consumer imports** — the new aesthetic actually becomes visible after this PR.
- Sidebar + nav-link don't import shadcn primitives — they use semantic HTML + lucide icons + the global tokens. No swap needed there.
- Sheet stays on slim shadcn (no 8bit variant in registry).

---

## WSM-000033 — Roster + depth chart consumer swaps

**PR:** #138

### Files touched
- `apps/web/src/components/roster/{AssignPlayerDialog,RosterStatusList,RosterSlotGroup}.tsx`
- `apps/web/src/components/depth-chart/LockBanner.tsx`

### Key decisions
- 4 files, ~7 import lines swapped.
- Components without explicit ui imports (RosterBoard, RosterAuditTimeline, RosterLimitBadge, DepthChartBoard, PositionColumn) inherit the aesthetic via tokens for free.

---

## WSM-000034 — Entity surface mass swap

**PR:** #139

### Files touched
- 23 files across `apps/web/src/app/dashboard/{leagues,teams,players,seasons,divisions,billing,import,discover}/` plus `_components/{player-form,team-edit-form}.tsx` and root `page.tsx` / `error.tsx`.

### Key decisions
- Single `sed` pass: `s|from "@/components/ui/(button|input|label|textarea|dialog|dropdown-menu|select|card|table|skeleton|separator)"|from "@/components/ui/8bit/\1"|g`
- Skipped per prior-story deferrals: badge, tabs, sheet, tooltip.

---

## WSM-000035 — E2E sweep

**PR:** combined with WSM-000036 in this PR (zero diff)

### Result
- `pnpm exec playwright test --grep "Roster management"` ran against the re-skinned local dev — **9 passed (44.2s), zero selector changes needed**.
- Semantic selectors (`getByRole`, `getByLabel`, `getByText`, `getByRole("dialog")`, `getByRole("menuitem")`) all survived the 8bit wrap because Radix primitives preserve role + aria attributes through the wrapper layer.
- No commit produced. The sweep result IS the deliverable — captured in this closeout doc.

---

## WSM-000036 — Docs + closeout

**PR:** this PR

### Files touched
- `docs/sprints/SPRINT_3_VERIFICATION.md` (new)
- `docs/sprints/SPRINT_3_CLOSEOUT.md` (this file)

---

## Running baseline at sprint close

- `pnpm --filter @sports-management/web type-check` — clean
- `pnpm --filter @sports-management/web lint` — one pre-existing warning (member-list `<img>`), no new
- `pnpm exec playwright test --grep "Roster management"` — **9 passed** (no regression vs. Sprint 2 close)

## Where Sprint 4 picks up

Sprint 4 ships **Phase 2 — `player_attributes_v1`** native to the 8-bit aesthetic (line chart components built as `PixelLineChart` from the get-go, position-attributes table using `8bit/Table`, etc.). Outline locked in pre-Sprint-3 grill:

```
WSM-000037  Schema: playerAttributes table + indexes
WSM-000038  Flag: player_attributes_v1
WSM-000039  Source adapters: PFF + Madden + admin-JSON normalizers
WSM-000040  Ingest mutation: ingestPlayerAttributes
WSM-000041  Query API: getPlayerDevelopment + getSeasonAttributesByPosition
WSM-000042  Public-read primitives: leagues.isPublic + publicLeagueGuard
WSM-000043  UI: /dashboard/players/[id]/development (8-bit chart)
WSM-000044  UI: /leagues/[slug]/players/[id]/development (public)
WSM-000045  UI: /dashboard/seasons/[id]/attributes/[positionGroup]
WSM-000046  UI: admin upload + Make-public toggle
WSM-000047  E2E coverage
WSM-000048  Analytics + docs + Sprint 4 closeout
```

Sprint 5 (subsequent): Salesforce decoupling per the "full-throttle Convex" direction.

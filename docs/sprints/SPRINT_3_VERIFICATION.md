# Sprint 3 — 8-bit Re-skin — Verification Report

> **Status:** Code merged to `main`. No production flag flip required (the re-skin replaces the existing aesthetic outright; no flag gates any of it).
> **Closed (code):** 2026-04-28
> **Source plan:** Conversation grill on 2026-04-28; locked decisions captured below.
> **Anchor library:** [8bitcn/ui](https://www.8bitcn.com) registry on top of existing shadcn/ui + Tailwind v4 + Geist + Pixelify Sans.

Sprint 3 swaps the entire app aesthetic from shadcn-modern to 8-bit indie pixel-art (Stardew/Celeste-leaning). Eleven stories shipped as eleven PRs.

## Locked decisions (from grill)

| # | Question | Resolution |
|---|---|---|
| 1 | Sequence vs Phase 2 (player attributes)? | Re-skin first; Phase 2 deferred to Sprint 4 |
| 2 | Aesthetic anchor? | Modern indie pixel-art (Stardew/Celeste palette freedom, NES-leaning chunky borders) |
| 3 | Component approach? | Layer 8bitcn on top of shadcn (8bit components wrap shadcn ones — both layers stay) |
| 4 | Heading font? | Pixelify Sans via `next/font/google` (4 weights) |
| 5 | Body / mono font? | Geist Sans + Geist Mono via `geist` package |
| 6 | Merge strategy? | One PR per story (11 PRs) — matches Sprint 1/2 cadence |
| 7 | Salesforce mirror in sprint? | Defer (full-throttle Convex direction; SF decoupling becomes Sprint 5+) |

## Criteria Matrix

| # | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| 1 | `components.json` exists with `@8bitcn` registry pointer | `apps/web/components.json` | ✓ |
| 2 | Sprtsmng-specific design tokens (palette, radii, scanlines, dark mode) | `apps/web/src/app/globals.css` `@theme` + `.dark` blocks | ✓ |
| 3 | Pixelify Sans loaded via `next/font` for headings | `apps/web/src/app/layout.tsx` + `--font-display` token | ✓ |
| 4 | Geist Sans / Mono loaded via `geist` package | same | ✓ |
| 5 | All `h1-h6` inherit `--font-display` globally | `globals.css` heading rule | ✓ |
| 6 | `.retro` (from 8bitcn `retro.css`) overridden to use Pixelify Sans, not Press Start 2P | `globals.css` `.retro { font-family: var(--font-display) !important; }` | ✓ |
| 7 | 8bit Button + Input + Label + Textarea installed at `src/components/ui/8bit/` | filesystem | ✓ |
| 8 | 8bit Dialog + DropdownMenu + Select installed | filesystem | ✓ |
| 9 | 8bit Card + Table + Skeleton + Separator installed | filesystem | ✓ |
| 10 | Dashboard chrome + marketing surfaces consume `8bit/*` | `mobile-header.tsx`, `marketing/{header,hero,features}.tsx` | ✓ |
| 11 | Roster + depth-chart features consume `8bit/*` | `roster/{AssignPlayerDialog,RosterStatusList,RosterSlotGroup}.tsx`, `depth-chart/LockBanner.tsx` | ✓ |
| 12 | All entity dashboard surfaces (leagues / teams / players / seasons / divisions / billing / import) consume `8bit/*` | 23 files swapped in WSM-000034 | ✓ |
| 13 | Type-check + lint clean after every story | each PR's CI | ✓ |
| 14 | Full coach-roster e2e suite passes against the re-skinned app | local run, 9 passed in 44.2s, zero selector changes needed | ✓ |
| 15 | Pre-existing Vitest suites still pass | unchanged across the sprint | ✓ |

## PR / Release Evidence

| Story | Branch | PR | Expected bump |
| --- | --- | --- | --- |
| WSM-000026 | `feat/WSM-000026-8bitcn-registry` | #131 | minor |
| WSM-000027 | `feat/WSM-000027-design-tokens` | #132 | minor |
| WSM-000028 | `feat/WSM-000028-typography` | #133 | minor |
| WSM-000029 | `feat/WSM-000029-form-primitives` | #134 | minor |
| WSM-000030 | `feat/WSM-000030-overlays` | #135 | minor |
| WSM-000031 | `feat/WSM-000031-display` | #136 | minor |
| WSM-000032 | `feat/WSM-000032-dashboard-chrome` | #137 | minor |
| WSM-000033 | `feat/WSM-000033-roster-features` | #138 | minor |
| WSM-000034 | `feat/WSM-000034-entities` | #139 | minor |
| WSM-000035 + WSM-000036 | `feat/WSM-000035-036-e2e-sweep-closeout` | this PR | no bump (`docs:` + `test:` no-op) |

## Deferred / Follow-ups

1. **8bit Badge variant** — re-installing canonical shadcn badge would drop the project's local `success` and `warning` variants used by `status-badge.tsx`. Reconciliation path: either port `status-badge.tsx` to the canonical variant set, or extend the canonical badge with custom variants. Tracked for Sprint 4 docs cleanup.
2. **8bit Tabs variant** — upstream 8bitcn TS bug (`BitTabsContentProps` recursively references itself). Shadcn primitive in place; revisit when upstream fixes.
3. **8bit Tooltip variant** — same upstream TS bug pattern as Tabs. Shadcn tooltip primitive installed for future use.
4. **8bit Sheet variant** — not in 8bitcn registry. `mobile-header.tsx` keeps the slim shadcn Sheet.
5. **8bit Sonner / Toaster variant** — not in 8bitcn registry. Existing sonner Toaster stays in `layout.tsx`.
6. **Visual regression baseline** — no Playwright screenshot tests added. Spot-checked via Vercel preview deploys. If visual drift becomes a concern, add a small `--update-snapshots` flow in Sprint 4.

## Risks closed

- **Aesthetic dissonance window** — avoided by sequencing re-skin BEFORE Phase 2 player attributes (Sprint 4), so Phase 2 ships native to 8-bit.
- **E2E suite regression** — eliminated. Semantic selectors (`getByRole`, `getByLabel`, `getByText`) survived the 8bit wrap because Radix primitives preserve role + aria attributes. 9/9 coach-roster scenarios pass with zero spec changes.
- **Per-page rebuild burden** — minimized via the global token system. Components without explicit ui imports (RosterBoard, RosterAuditTimeline, RosterLimitBadge, DepthChartBoard, PositionColumn) inherit the aesthetic for free.

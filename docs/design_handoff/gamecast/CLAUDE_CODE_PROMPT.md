# Claude Code — kickoff prompt

Paste the block below into Claude Code, run from the repo root of
`sports-league-management`. It assumes this handoff folder is available in the
repo (or paste the README contents inline).

---

We're redesigning the **Gamecast** screen. A complete high-fidelity spec is in
`docs/design_handoff/gamecast/README.md` with reference screenshots in
`docs/design_handoff/gamecast/screens/` and an interactive prototype at
`docs/design_handoff/gamecast/Gamecast.dc.html`. Read the README in full first.

Context you must respect:
- This is a Next.js / React app. The Gamecast lives at
  `apps/web/src/app/dashboard/games/[fixtureId]/gamecast/page.tsx` and
  `apps/web/src/components/gamecast/*`.
- The game data is the persisted **`PbpGameLog`** (see `apps/web/src/lib/pbp`),
  loaded server-side via `parseGamePlayLog` and passed to `GamecastView`.
  **Use that real log** — the prototype's built-in simulation engine is
  throwaway and must not be ported.
- Reuse the existing `@/lib/gamecast` helpers; add the new pure functions the
  README lists (`prevPlayIndex`, `prevQuarterIndex`, `prevHalfIndex`,
  `winProbabilityAtPosition` + `winProbabilitySeries`, `boxScoreAtPosition`,
  `scoringSummaryAtPosition`) and export them from `lib/gamecast/index.ts`.
- Style **only** with `packages/design-system` tokens/CSS variables and its
  components (`Card`, `Table`, `Badge`, `Segmented`, `Button`, `IconButton`,
  `Icon`). Don't invent colors/spacing/type. The one allowed exception is the
  team + field content colors named in the README (team brand, LOS/first-down/
  ball). Add the 6 media-control glyphs (play/pause/next/prev/start/end) to the
  DS `Icon` component — no emoji.

Build order:
1. Add the new pure lib functions + Vitest unit tests mirroring the existing
   `lib/gamecast/__tests__` style.
2. Build the new leaf components: `FieldPosition`, `WinProbability`, `BoxScore`,
   `ScoringSummary`.
3. Extend `GamecastControls` (mode toggle, prev/next play·quarter·half,
   play/pause + speed auto-sim, review scrubber vs. sim progress bar).
4. Rework `GamecastView` to own the single source of truth
   (`playIndex`, `mode`, `playing`, `speed`) and compose everything. Everything
   derives from `playIndex`; memoize the heavy series on `log`.
5. Implement **layout 1a (Broadcast)** first (the recommended default). Get it
   matching `screens/1a-broadcast.png`, then confirm with me before doing 1b/1c
   — we may only ship one.
6. Make it responsive (single column below ~900px, per the README).
7. Extend `apps/web/e2e/tests/gamecast.spec.ts` to cover prev-play, quarter/half
   jumps, the review scrubber, mode switch, and auto-sim start/stop.

Constraints:
- Keep the existing `GamecastEmptyState` (`no_log` / `parse_error`) behavior.
- Respect `prefers-reduced-motion` as `GamecastView` does today.
- Don't touch the simulation engine, schema, or persistence — this is a
  presentation-layer change reading data you already store.

Start by reading the README and the current `gamecast/` + `lib/gamecast/` +
`lib/pbp/` files, then propose the file-level plan (new files, edited files, new
lib exports) and wait for my go-ahead before writing code.

# Kickoff prompt — Leagues & Seasons redesign

Use this to start an implementation session for the Leagues & Seasons handoff.

---

Implement the Leagues & Seasons redesign from the handoff at
`docs/design_handoff/leagues-seasons/README.md`. Read that README fully first —
it contains the screen specs, verbatim copy, gap table, and constraints. The
readable prototype source is in `docs/design_handoff/leagues-seasons/decoded/`
(module map in the README); open the runnable prototype at
`docs/design_handoff/prototypes/Leagues & Seasons - Prototype.html` in a browser
when a layout question isn't answered by the source.

Ground rules:

1. **Slice the work.** Do not attempt the whole handoff in one PR. Suggested
   order (each independently shippable):
   a. Teams page redesign + TeamDetailSheet drawer (thinnest current page, no
      new data needed)
   b. Seasons list + New season dialog + Season hub polish
   c. League info/manage split + Overview page
   d. Divisions + Players pages (new)
   e. Schedule/Standings/Playoffs treatments (accordion weeks, playoff-cut
      divider, clinched badges, bracket phases)
   f. GameView drawer (coordinate with the gamecast handoff)
2. Component strategy is decided: **shadcn** (see README). Add missing
   primitives via the shadcn CLI; do not introduce
   `@sports-management/design-system` React components into the dashboard.
3. Styling via existing tokens/Tailwind bridge in `apps/web/src/app/globals.css`
   — no hex/px literals, no new tokens.
4. Data via `apps/web/src/lib/data-api.ts` only. The backend already supports
   the flows; do not add Convex mutations unless a genuine gap is found.
5. Respect the "Do not replicate" and "Constraints" sections — especially: no
   score-derived gamecast synthesis, keep permission gating and feature flags,
   preserve public/unauthenticated mirrors under `/leagues/[id]/*`.
6. Reuse the prototype's confirmation and ProcessingModal copy verbatim for the
   season-lifecycle flows; wire the steplog to the real staged rollover
   (`beginSeasonRollover`/`advanceSeasonRollover`).
7. Tests: extend the existing Playwright e2e patterns (see
   `apps/web/e2e/`) for each redesigned page; unit-test any new pure logic.
   Keep flag-gated routes 404-ing when disabled.
8. Work in a dedicated worktree, conventional commits, one PR per slice.

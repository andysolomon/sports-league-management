# Design handoffs

High-fidelity design references for implementation — interactive HTML prototypes,
screenshots, and kickoff prompts. These are **not** production code; recreate
them in the app using `packages/design-system` and the relevant app modules.

| Handoff | Description |
|---|---|
| [gamecast/](gamecast/README.md) | Gamecast redesign — Sim & Review modes, three layout directions |
| [leagues-seasons/](leagues-seasons/README.md) | Leagues & Seasons operator experience — Overview, Leagues/Manage split, Seasons, Teams, Players, Divisions, GameView drawer, dynasty lifecycle flows |

When adding a new handoff, create a subfolder here (e.g. `docs/design_handoff/<feature>/`)
with at minimum:

- `README.md` — spec, fidelity expectations, target repo files
- `screens/` — reference screenshots (when applicable)
- optional HTML prototype and `CLAUDE_CODE_PROMPT.md` for agent kickoff

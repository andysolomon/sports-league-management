# sprtsmng TUI

Internal operator console for the Sports Management platform. Browse leagues, teams, players, seasons, and divisions from your terminal. Bulk import teams from CSV and reassign players between teams.

## Setup

```bash
pnpm install
pnpm tui login
```

## Commands

| Command | Description |
|---|---|
| `pnpm tui` | Launch interactive TUI with menu |
| `pnpm tui login` | Authenticate by pasting a Clerk API key |
| `pnpm tui leagues` | Browse leagues (list view) |
| `pnpm tui seasons` | Browse seasons |
| `pnpm tui divisions` | Browse divisions |
| `pnpm tui import-teams <csv>` | Bulk import teams from a CSV file |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `↑` / `k` | Move cursor up |
| `↓` / `j` | Move cursor down |
| `Enter` | Open / confirm |
| `Esc` | Go back |
| `Space` | Toggle selection (multi-select) |
| `Ctrl+A` | Select all |
| `Ctrl+D` | Clear selection |
| `r` | Reassign selected players to another team |
| `d` | Toggle debug panel (API timing + token state) |
| `e` | Open errors viewer |
| `q` | Quit |

## Navigation

```
Home menu
├── Browse leagues → Enter → Teams in league → Enter → Players in team
├── Browse seasons (flat list)
└── Browse divisions (flat list)

From any screen:
  d → Debug panel (API call timing + token state)
  e → Errors viewer (recent API errors with full payload)
  q → Quit
```

## Example: Browse Leagues

```
┌─────────────────────────────────────────────────────┐
│ sprtsmng tui                    user@example.com    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Leagues (3)                                        │
│                                                     │
│  [ ] ❯ Premier League (lg_001)                      │
│  [ ]   La Liga (lg_002)                             │
│  [ ]   Bundesliga (lg_003)                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ↑↓ navigate · enter open · esc back · q quit       │
└─────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SPRTSMNG_API_URL` | `https://sprtsmng.andrewsolomon.dev` | Backend API URL |
| `XDG_CONFIG_HOME` | `~/.config` | Config directory (credentials stored at `<dir>/sprtsmng/auth.json`) |

## CSV Import Format

For `import-teams`, the CSV must have a header row with these columns:

```csv
name,leagueId,city,stadium
Arsenal,lg_001,London,Emirates Stadium
Chelsea,lg_001,London,Stamford Bridge
```

## Development

```bash
# Run the TUI in dev mode
pnpm tui

# Run tests
pnpm --filter @sports-management/tui test:unit

# Type-check
pnpm --filter @sports-management/tui type-check

# Lint
pnpm --filter @sports-management/tui lint
```

## Architecture

- **Entry:** `src/cli.tsx` — meow CLI dispatcher
- **Screens:** `src/screens/` — one file per screen (Ink components)
- **Hooks:** `src/hooks/` — useKeyboardNav, useMultiSelect, useScreen (router)
- **Lib:** `src/lib/` — API client, credentials, config, trackers
- **Commands:** `src/commands/` — non-Ink CLI commands (login, import-teams)

## v0.4.0-tui Milestone

Released as git tag `v0.4.0-tui`. Internal beta — not published to npm.

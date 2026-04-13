#!/usr/bin/env -S tsx
import meow from "meow";

const cli = meow(
  `
  Usage
    $ pnpm tui [command]

  Commands
    login                Authenticate with sprtsmng by pasting an API key
    leagues              Browse leagues (list view)
    seasons              Browse seasons
    divisions            Browse divisions
    import-teams <csv>   Bulk import teams from a CSV file
    import-json <json>   Import leagues, teams, and players from a JSON file
    (no command)         Launch the interactive TUI

  Environment
    SPRTSMNG_API_URL    Override the backend URL (default: production)
    XDG_CONFIG_HOME     Override the credentials directory
`,
  { importMeta: import.meta },
);

const command = cli.input[0];

if (command === "login") {
  const { runLogin } = await import("./commands/login.js");
  try {
    await runLogin();
    process.exit(0);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
} else if (command === "import-teams") {
  const csvPath = cli.input[1];
  if (!csvPath) {
    console.error("Usage: pnpm tui import-teams <path-to-csv>");
    process.exit(1);
  }
  const { runImportTeams } = await import("./commands/import-teams.js");
  try {
    await runImportTeams(csvPath);
    process.exit(0);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
} else if (command === "import-json") {
  const jsonPath = cli.input[1];
  if (!jsonPath) {
    console.error("Usage: pnpm tui import-json <path-to-json>");
    process.exit(1);
  }
  const { runImportJson } = await import("./commands/import-json.js");
  try {
    await runImportJson(jsonPath);
    process.exit(0);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
} else if (command === "leagues" || command === "seasons" || command === "divisions") {
  const React = await import("react");
  const { render } = await import("ink");
  const { App } = await import("./App.js");
  render(React.createElement(App, { initialScreen: command }));
} else if (command === undefined) {
  const React = await import("react");
  const { render } = await import("ink");
  const { App } = await import("./App.js");
  render(React.createElement(App, {}));
} else {
  console.error(`Unknown command: ${command}`);
  console.error(cli.help);
  process.exit(1);
}

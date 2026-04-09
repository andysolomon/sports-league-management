#!/usr/bin/env -S tsx
import meow from "meow";

const cli = meow(
  `
  Usage
    $ pnpm tui [command]

  Commands
    login          Authenticate with sprtsmng by pasting an API key
    leagues        Browse leagues (list view)
    (no command)   Launch the interactive TUI

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
} else if (command === "leagues") {
  const React = await import("react");
  const { render } = await import("ink");
  const { App } = await import("./App.js");
  render(React.createElement(App, { initialScreen: "leagues" }));
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

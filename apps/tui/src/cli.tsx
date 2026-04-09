#!/usr/bin/env -S tsx
import meow from "meow";
import React from "react";
import { render, Box, Text } from "ink";

const cli = meow(
  `
  Usage
    $ pnpm tui [command]

  Commands
    login          Authenticate with sprtsmng by pasting an API key
    (no command)   Launch the interactive TUI

  Environment
    SPRTSMNG_API_URL    Override the backend URL (default: production)
    XDG_CONFIG_HOME     Override the credentials directory
`,
  { importMeta: import.meta },
);

function App() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="blue">
        sprtsmng tui
      </Text>
      <Text dimColor>v0.4.0 — internal operator console</Text>
      <Text> </Text>
      <Text>
        <Text color="gray">Press </Text>
        <Text bold>Ctrl+C</Text>
        <Text color="gray"> to quit.</Text>
      </Text>
    </Box>
  );
}

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
} else if (command === undefined) {
  render(<App />);
} else {
  console.error(`Unknown command: ${command}`);
  console.error(cli.help);
  process.exit(1);
}

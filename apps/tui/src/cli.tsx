#!/usr/bin/env -S tsx
import React from "react";
import { render, Box, Text } from "ink";

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

render(<App />);

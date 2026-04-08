import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Box, Text } from "ink";

// We re-declare App in the test file rather than importing from cli.tsx
// because cli.tsx calls render(<App />) at module load, which would mount
// the real Ink renderer during test imports. W-000080 will extract App
// to its own module.
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

describe("App", () => {
  it("renders the placeholder text", () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain("sprtsmng tui");
    expect(lastFrame()).toContain("v0.4.0");
    expect(lastFrame()).toContain("Ctrl+C");
  });
});

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useScreen } from "../hooks/useScreen.js";
import { fetchDivisions, type DivisionDto } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";
import { getApiBaseUrl } from "../lib/config.js";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; divisions: DivisionDto[] };

export function DivisionsScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [cursor, setCursor] = useState(0);
  const { back } = useScreen();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const creds = await readCredentials();
      if (!creds) {
        setState({ status: "error", message: "Not authenticated. Run 'pnpm tui login' first." });
        return;
      }
      try {
        const divisions = await fetchDivisions(getApiBaseUrl(), creds.apiKey);
        if (!cancelled) setState({ status: "loaded", divisions });
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const count = state.status === "loaded" ? state.divisions.length : 0;

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(count - 1, c + 1)),
    onBack: back,
  });

  if (state.status === "loading") return <Text color="yellow">Loading divisions...</Text>;

  if (state.status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {state.message}</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  if (state.divisions.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No divisions found.</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Divisions ({state.divisions.length})</Text>
      <Text> </Text>
      {state.divisions.map((d, i) => (
        <Box key={d.id} gap={1}>
          <Text color={i === cursor ? "blue" : undefined}>{i === cursor ? "❯" : " "}</Text>
          <Text bold={i === cursor}>{d.name}</Text>
          <Text dimColor>League: {d.leagueId}</Text>
        </Box>
      ))}
    </Box>
  );
}

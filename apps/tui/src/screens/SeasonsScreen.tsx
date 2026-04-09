import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useScreen } from "../hooks/useScreen.js";
import { fetchSeasons, type SeasonDto } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";
import { getApiBaseUrl } from "../lib/config.js";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; seasons: SeasonDto[] };

export function SeasonsScreen() {
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
        const seasons = await fetchSeasons(getApiBaseUrl(), creds.apiKey);
        if (!cancelled) setState({ status: "loaded", seasons });
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const count = state.status === "loaded" ? state.seasons.length : 0;

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(count - 1, c + 1)),
    onBack: back,
  });

  if (state.status === "loading") return <Text color="yellow">Loading seasons...</Text>;

  if (state.status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {state.message}</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  if (state.seasons.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No seasons found.</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Seasons ({state.seasons.length})</Text>
      <Text> </Text>
      {state.seasons.map((s, i) => (
        <Box key={s.id} gap={1}>
          <Text color={i === cursor ? "blue" : undefined}>{i === cursor ? "❯" : " "}</Text>
          <Text bold={i === cursor}>{s.name}</Text>
          <Text dimColor>{s.startDate ?? "—"} → {s.endDate ?? "—"}</Text>
          <Text color={s.status === "Active" ? "green" : "yellow"}>{s.status}</Text>
        </Box>
      ))}
    </Box>
  );
}

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useMultiSelect } from "../hooks/useMultiSelect.js";
import { useScreen } from "../hooks/useScreen.js";
import { fetchLeagues, type LeagueDto } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";
import { getApiBaseUrl } from "../lib/config.js";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; leagues: LeagueDto[] };

export function LeaguesScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [cursor, setCursor] = useState(0);
  const { push, back } = useScreen();

  const leagues = state.status === "loaded" ? state.leagues : [];
  const { selectedCount, toggle, selectAll, clearAll, isSelected } =
    useMultiSelect(leagues);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const creds = await readCredentials();
      if (!creds) {
        setState({
          status: "error",
          message: "Not authenticated. Run 'pnpm tui login' first.",
        });
        return;
      }

      try {
        const data = await fetchLeagues(getApiBaseUrl(), creds.apiKey);
        if (!cancelled) setState({ status: "loaded", leagues: data });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(leagues.length - 1, c + 1)),
    onSelect: () => {
      if (leagues[cursor]) {
        const league = leagues[cursor];
        push("teams", { leagueId: league.id, leagueName: league.name });
      }
    },
    onToggle: () => {
      if (leagues[cursor]) toggle(leagues[cursor].id);
    },
    onSelectAll: () => selectAll(),
    onClearAll: () => clearAll(),
    onBack: back,
  });

  if (state.status === "loading") {
    return <Text color="yellow">Loading leagues...</Text>;
  }

  if (state.status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {state.message}</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  if (leagues.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No leagues found.</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text bold>Leagues ({leagues.length})</Text>
        {selectedCount > 0 && (
          <Text dimColor>· {selectedCount} selected</Text>
        )}
      </Box>
      <Text> </Text>
      {leagues.map((league, i) => (
        <Box key={league.id} gap={1}>
          <Text>{isSelected(league.id) ? "[✓]" : "[ ]"}</Text>
          <Text color={i === cursor ? "blue" : undefined}>
            {i === cursor ? "❯" : " "}
          </Text>
          <Text bold={i === cursor}>{league.name}</Text>
          <Text dimColor>({league.id})</Text>
        </Box>
      ))}
    </Box>
  );
}

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
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
  const { back } = useScreen();

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
        const leagues = await fetchLeagues(getApiBaseUrl(), creds.apiKey);
        if (!cancelled) {
          setState({ status: "loaded", leagues });
        }
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

  const leagueCount =
    state.status === "loaded" ? state.leagues.length : 0;

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(leagueCount - 1, c + 1)),
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

  if (state.leagues.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No leagues found.</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Leagues ({state.leagues.length})</Text>
      <Text> </Text>
      {state.leagues.map((league, i) => (
        <Box key={league.id}>
          <Text color={i === cursor ? "blue" : undefined}>
            {i === cursor ? "❯ " : "  "}
          </Text>
          <Text bold={i === cursor}>{league.name}</Text>
          <Text dimColor> ({league.id})</Text>
        </Box>
      ))}
    </Box>
  );
}

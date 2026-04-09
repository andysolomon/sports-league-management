import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useScreen } from "../hooks/useScreen.js";
import { fetchTeams, type TeamDto } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";
import { getApiBaseUrl } from "../lib/config.js";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; teams: TeamDto[] };

export function TeamsScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [cursor, setCursor] = useState(0);
  const { params, push, back } = useScreen();

  const leagueId = params.leagueId as string;
  const leagueName = (params.leagueName as string) ?? leagueId;

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
        const teams = await fetchTeams(getApiBaseUrl(), creds.apiKey, leagueId);
        if (!cancelled) {
          setState({ status: "loaded", teams });
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
  }, [leagueId]);

  const teamCount = state.status === "loaded" ? state.teams.length : 0;

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(teamCount - 1, c + 1)),
    onSelect: () => {
      if (state.status === "loaded" && state.teams[cursor]) {
        const team = state.teams[cursor];
        push("players", { teamId: team.id, teamName: team.name });
      }
    },
    onBack: back,
  });

  if (state.status === "loading") {
    return <Text color="yellow">Loading teams for {leagueName}...</Text>;
  }

  if (state.status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {state.message}</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  if (state.teams.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No teams in {leagueName}.</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Teams in {leagueName} ({state.teams.length})</Text>
      <Text> </Text>
      {state.teams.map((team, i) => (
        <Box key={team.id} gap={1}>
          <Text color={i === cursor ? "blue" : undefined}>
            {i === cursor ? "❯" : " "}
          </Text>
          <Text bold={i === cursor}>{team.name}</Text>
          <Text dimColor>{team.city}</Text>
          <Text dimColor>· {team.stadium}</Text>
        </Box>
      ))}
    </Box>
  );
}

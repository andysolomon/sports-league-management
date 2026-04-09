import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useMultiSelect } from "../hooks/useMultiSelect.js";
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

  const teams = state.status === "loaded" ? state.teams : [];
  const { selectedCount, toggle, selectAll, clearAll, isSelected } =
    useMultiSelect(teams);

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
        const data = await fetchTeams(getApiBaseUrl(), creds.apiKey, leagueId);
        if (!cancelled) setState({ status: "loaded", teams: data });
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

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(teams.length - 1, c + 1)),
    onSelect: () => {
      if (teams[cursor]) {
        const team = teams[cursor];
        push("players", { teamId: team.id, teamName: team.name });
      }
    },
    onToggle: () => {
      if (teams[cursor]) toggle(teams[cursor].id);
    },
    onSelectAll: () => selectAll(),
    onClearAll: () => clearAll(),
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

  if (teams.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No teams in {leagueName}.</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text bold>Teams in {leagueName} ({teams.length})</Text>
        {selectedCount > 0 && (
          <Text dimColor>· {selectedCount} selected</Text>
        )}
      </Box>
      <Text> </Text>
      {teams.map((team, i) => (
        <Box key={team.id} gap={1}>
          <Text>{isSelected(team.id) ? "[✓]" : "[ ]"}</Text>
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

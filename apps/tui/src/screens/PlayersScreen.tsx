import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useScreen } from "../hooks/useScreen.js";
import { useMultiSelect } from "../hooks/useMultiSelect.js";
import { fetchPlayers, type PlayerDto } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";
import { getApiBaseUrl } from "../lib/config.js";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; players: PlayerDto[] };

export function PlayersScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [cursor, setCursor] = useState(0);
  const { params, push, back } = useScreen();

  const teamId = params.teamId as string;
  const teamName = (params.teamName as string) ?? teamId;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const creds = await readCredentials();
      if (!creds) {
        setState({ status: "error", message: "Not authenticated. Run 'pnpm tui login' first." });
        return;
      }
      try {
        const players = await fetchPlayers(getApiBaseUrl(), creds.apiKey, teamId);
        if (!cancelled) setState({ status: "loaded", players });
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [teamId]);

  const players = state.status === "loaded" ? state.players : [];
  const { selectedCount, toggle, selectAll, clearAll, isSelected } =
    useMultiSelect(players);

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(players.length - 1, c + 1)),
    onToggle: () => {
      if (players[cursor]) toggle(players[cursor].id);
    },
    onSelectAll: () => selectAll(),
    onClearAll: () => clearAll(),
    onReassign: () => {
      if (selectedCount > 0) {
        const selectedPlayers = players.filter((p) => isSelected(p.id));
        push("team-picker", {
          playerIds: selectedPlayers.map((p) => p.id),
          playerNames: selectedPlayers.map((p) => p.name),
          leagueId: params.leagueId,
        });
      }
    },
    onBack: back,
  });

  if (state.status === "loading") return <Text color="yellow">Loading players for {teamName}...</Text>;

  if (state.status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {state.message}</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  if (state.players.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No players in {teamName}.</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text bold>Players in {teamName} ({players.length})</Text>
        {selectedCount > 0 && (
          <Text dimColor>· {selectedCount} selected · press r to reassign</Text>
        )}
      </Box>
      <Text> </Text>
      {players.map((p, i) => (
        <Box key={p.id} gap={1}>
          <Text>{isSelected(p.id) ? "[✓]" : "[ ]"}</Text>
          <Text color={i === cursor ? "blue" : undefined}>{i === cursor ? "❯" : " "}</Text>
          <Text bold={i === cursor}>{p.name}</Text>
          <Text dimColor>{p.position}</Text>
          <Text dimColor>#{p.jerseyNumber ?? "—"}</Text>
          <Text color={p.status === "Active" ? "green" : "yellow"}>{p.status}</Text>
        </Box>
      ))}
    </Box>
  );
}

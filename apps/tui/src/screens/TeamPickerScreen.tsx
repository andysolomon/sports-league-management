import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useScreen } from "../hooks/useScreen.js";
import { fetchTeams, reassignPlayer, type TeamDto } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";
import { getApiBaseUrl } from "../lib/config.js";

type Phase =
  | { status: "loading-teams" }
  | { status: "picking"; teams: TeamDto[] }
  | { status: "confirming"; teams: TeamDto[]; targetTeam: TeamDto }
  | { status: "executing"; total: number; done: number; failed: number }
  | { status: "done"; created: number; failed: number; errors: string[] };

export function TeamPickerScreen() {
  const [phase, setPhase] = useState<Phase>({ status: "loading-teams" });
  const [cursor, setCursor] = useState(0);
  const { params, back } = useScreen();

  const playerIds = params.playerIds as string[];
  const playerNames = params.playerNames as string[];
  const sourceTeamLeagueId = params.leagueId as string | undefined;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const creds = await readCredentials();
      if (!creds) return;

      try {
        const baseUrl = getApiBaseUrl();
        // Fetch all teams (or by league if available)
        const teams = sourceTeamLeagueId
          ? await fetchTeams(baseUrl, creds.apiKey, sourceTeamLeagueId)
          : [];
        if (!cancelled) {
          setPhase({ status: "picking", teams });
        }
      } catch {
        if (!cancelled) back();
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sourceTeamLeagueId, back]);

  useKeyboardNav({
    onUp: () => {
      if (phase.status === "picking") {
        setCursor((c) => Math.max(0, c - 1));
      }
    },
    onDown: () => {
      if (phase.status === "picking") {
        setCursor((c) => Math.min(phase.teams.length - 1, c + 1));
      }
    },
    onSelect: () => {
      if (phase.status === "picking" && phase.teams[cursor]) {
        setPhase({ ...phase, status: "confirming", targetTeam: phase.teams[cursor] });
      } else if (phase.status === "confirming") {
        // Execute reassignment
        executeReassign(phase.targetTeam);
      }
    },
    onBack: () => {
      if (phase.status === "confirming") {
        setPhase({ status: "picking", teams: (phase as Extract<Phase, { status: "confirming" }>).teams });
      } else if (phase.status === "done") {
        back();
      } else {
        back();
      }
    },
  });

  async function executeReassign(targetTeam: TeamDto) {
    setPhase({ status: "executing", total: playerIds.length, done: 0, failed: 0 });

    const creds = await readCredentials();
    if (!creds) return;

    const baseUrl = getApiBaseUrl();
    let done = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const playerId of playerIds) {
      try {
        await reassignPlayer(baseUrl, creds.apiKey, playerId, targetTeam.id);
        done++;
      } catch (err) {
        failed++;
        errors.push(err instanceof Error ? err.message : String(err));
      }
      setPhase({ status: "executing", total: playerIds.length, done: done + failed, failed });
    }

    setPhase({ status: "done", created: done, failed, errors });
  }

  if (phase.status === "loading-teams") {
    return <Text color="yellow">Loading teams...</Text>;
  }

  if (phase.status === "picking") {
    if (phase.teams.length === 0) {
      return (
        <Box flexDirection="column">
          <Text>No teams available.</Text>
          <Text dimColor>Press esc to go back.</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Text bold>Select destination team for {playerIds.length} player(s):</Text>
        <Text> </Text>
        {phase.teams.map((team, i) => (
          <Box key={team.id} gap={1}>
            <Text color={i === cursor ? "blue" : undefined}>
              {i === cursor ? "❯" : " "}
            </Text>
            <Text bold={i === cursor}>{team.name}</Text>
            <Text dimColor>{team.city}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  if (phase.status === "confirming") {
    return (
      <Box flexDirection="column">
        <Text bold color="yellow">
          Reassign {playerIds.length} player(s) to {phase.targetTeam.name}?
        </Text>
        <Text> </Text>
        {playerNames.slice(0, 5).map((name, i) => (
          <Text key={i} dimColor>• {name}</Text>
        ))}
        {playerNames.length > 5 && (
          <Text dimColor>...and {playerNames.length - 5} more</Text>
        )}
        <Text> </Text>
        <Text>
          <Text color="green" bold>enter</Text>
          <Text dimColor> confirm · </Text>
          <Text color="red" bold>esc</Text>
          <Text dimColor> cancel</Text>
        </Text>
      </Box>
    );
  }

  if (phase.status === "executing") {
    return (
      <Text color="yellow">
        Reassigning... [{phase.done}/{phase.total}]
      </Text>
    );
  }

  // done
  return (
    <Box flexDirection="column">
      <Text bold>
        Reassignment complete: {phase.created} succeeded, {phase.failed} failed.
      </Text>
      {phase.errors.length > 0 && (
        <>
          <Text> </Text>
          {phase.errors.map((e, i) => (
            <Text key={i} color="red">• {e}</Text>
          ))}
        </>
      )}
      <Text> </Text>
      <Text dimColor>Press esc to go back.</Text>
    </Box>
  );
}

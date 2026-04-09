import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useScreen } from "../hooks/useScreen.js";
import { apiTracker, type ApiCall } from "../lib/api-tracker.js";
import { readCredentials, type StoredCredentials } from "../lib/credentials.js";

export function DebugScreen() {
  const [creds, setCreds] = useState<StoredCredentials | null>(null);
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const { back } = useScreen();

  useEffect(() => {
    readCredentials().then(setCreds);
    setCalls(apiTracker.getRecent());
  }, []);

  useKeyboardNav({ onBack: back });

  return (
    <Box flexDirection="column">
      <Text bold>Debug Panel</Text>
      <Text> </Text>

      <Text bold underline>Token State</Text>
      {creds ? (
        <Box flexDirection="column">
          <Text>
            User: <Text color="green">{creds.email ?? creds.userId}</Text>
          </Text>
          <Text>
            Key created: <Text dimColor>{creds.createdAt}</Text>
          </Text>
        </Box>
      ) : (
        <Text color="red">Not authenticated</Text>
      )}

      <Text> </Text>
      <Text bold underline>Recent API Calls ({calls.length})</Text>
      {calls.length === 0 ? (
        <Text dimColor>No API calls recorded yet.</Text>
      ) : (
        calls.map((call, i) => (
          <Box key={i} gap={1}>
            <Text dimColor>{call.timestamp.slice(11, 19)}</Text>
            <Text>{call.method}</Text>
            <Text>{call.path}</Text>
            <Text color={call.status < 400 ? "green" : "red"}>
              {call.status}
            </Text>
            <Text dimColor>{call.durationMs}ms</Text>
          </Box>
        ))
      )}
    </Box>
  );
}

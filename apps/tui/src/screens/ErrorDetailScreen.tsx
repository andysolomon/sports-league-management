import React from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useScreen } from "../hooks/useScreen.js";
import type { TrackedError } from "../lib/error-tracker.js";

export function ErrorDetailScreen() {
  const { params, back } = useScreen();
  const error = params.error as TrackedError | undefined;

  useKeyboardNav({ onBack: back });

  if (!error) {
    return <Text color="red">No error data available.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold>Error Detail</Text>
      <Text> </Text>
      <Text>
        Timestamp: <Text dimColor>{error.timestamp}</Text>
      </Text>
      <Text>
        Status: <Text color="red">{error.status}</Text>
      </Text>
      <Text>
        Route: <Text>{error.route}</Text>
      </Text>
      <Text>
        Message: <Text>{error.message}</Text>
      </Text>
      <Text> </Text>
      <Text bold underline>Payload</Text>
      <Text>{JSON.stringify(error.payload, null, 2)}</Text>
    </Box>
  );
}

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";
import { useScreen } from "../hooks/useScreen.js";
import { errorTracker, type TrackedError } from "../lib/error-tracker.js";

export function ErrorsScreen() {
  const [errors, setErrors] = useState<TrackedError[]>([]);
  const [cursor, setCursor] = useState(0);
  const { push, back } = useScreen();

  useEffect(() => {
    setErrors(errorTracker.getRecent());
  }, []);

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(errors.length - 1, c + 1)),
    onSelect: () => {
      if (errors[cursor]) {
        push("error-detail", { error: errors[cursor] });
      }
    },
    onBack: back,
  });

  if (errors.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Recent Errors</Text>
        <Text> </Text>
        <Text dimColor>No errors recorded.</Text>
        <Text dimColor>Press esc to go back or q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Recent Errors ({errors.length})</Text>
      <Text> </Text>
      {errors.map((err, i) => (
        <Box key={i} gap={1}>
          <Text color={i === cursor ? "blue" : undefined}>
            {i === cursor ? "❯" : " "}
          </Text>
          <Text dimColor>{err.timestamp.slice(11, 19)}</Text>
          <Text color="red">{err.status}</Text>
          <Text>{err.route}</Text>
          <Text dimColor>{err.message.slice(0, 40)}</Text>
        </Box>
      ))}
    </Box>
  );
}

import React from "react";
import { Box, Text, useInput } from "ink";

interface ConfirmPanelProps {
  actionLabel: string;
  items: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPanel({
  actionLabel,
  items,
  onConfirm,
  onCancel,
}: ConfirmPanelProps) {
  useInput((input, key) => {
    if (key.return) onConfirm();
    if (key.escape || input === "n") onCancel();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={0}
    >
      <Text bold color="yellow">
        {actionLabel} ({items.length} items)
      </Text>
      <Text> </Text>
      {items.slice(0, 10).map((item, i) => (
        <Text key={i} dimColor>
          • {item}
        </Text>
      ))}
      {items.length > 10 && (
        <Text dimColor>...and {items.length - 10} more</Text>
      )}
      <Text> </Text>
      <Text>
        <Text color="green" bold>
          enter
        </Text>
        <Text dimColor> confirm · </Text>
        <Text color="red" bold>
          esc
        </Text>
        <Text dimColor> cancel</Text>
      </Text>
    </Box>
  );
}

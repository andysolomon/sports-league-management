import React from "react";
import { Box, Text } from "ink";

const DEFAULT_HINTS = "↑↓ navigate · enter open · esc back · q quit";

interface HeaderProps {
  email?: string | null;
}

export function Header({ email }: HeaderProps) {
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text bold color="blue">
        sprtsmng tui
      </Text>
      <Text dimColor>
        {email ? `${email}` : "not authenticated"}
      </Text>
    </Box>
  );
}

interface FooterProps {
  hints?: string;
}

export function Footer({ hints }: FooterProps) {
  return (
    <Box paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      <Text dimColor>{hints ?? DEFAULT_HINTS}</Text>
    </Box>
  );
}

interface StatusLineProps {
  message?: string;
}

export function StatusLine({ message }: StatusLineProps) {
  if (!message) return null;
  return (
    <Box paddingX={1}>
      <Text color="yellow">{message}</Text>
    </Box>
  );
}

interface LayoutProps {
  email?: string | null;
  hints?: string;
  status?: string;
  children: React.ReactNode;
}

export function Layout({ email, hints, status, children }: LayoutProps) {
  return (
    <Box flexDirection="column" minHeight={10}>
      <Header email={email} />
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {children}
      </Box>
      <StatusLine message={status} />
      <Footer hints={hints} />
    </Box>
  );
}

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { Layout } from "./components/Layout.js";
import { useKeyboardNav } from "./hooks/useKeyboardNav.js";
import { ScreenProvider, useScreen } from "./hooks/useScreen.js";
import { readCredentials } from "./lib/credentials.js";
import { LeaguesScreen } from "./screens/LeaguesScreen.js";

function HomeScreen() {
  const { push } = useScreen();

  useKeyboardNav({
    onSelect: () => push("leagues"),
  });

  return (
    <>
      <Text>v0.4.0 — internal operator console</Text>
      <Text> </Text>
      <Box>
        <Text color="blue">❯ </Text>
        <Text bold>Browse leagues</Text>
        <Text dimColor>  (press enter)</Text>
      </Box>
    </>
  );
}

function CurrentScreen() {
  const { current } = useScreen();

  switch (current) {
    case "leagues":
      return <LeaguesScreen />;
    default:
      return <HomeScreen />;
  }
}

function AppInner() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    readCredentials().then((creds) => {
      if (creds?.email) setEmail(creds.email);
    });
  }, []);

  return (
    <Layout email={email}>
      <CurrentScreen />
    </Layout>
  );
}

interface AppProps {
  initialScreen?: "home" | "leagues" | "league-detail" | "teams" | "players" | "seasons" | "divisions";
}

export function App({ initialScreen }: AppProps) {
  return (
    <ScreenProvider initialScreen={initialScreen}>
      <AppInner />
    </ScreenProvider>
  );
}

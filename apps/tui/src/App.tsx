import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { Layout } from "./components/Layout.js";
import { useKeyboardNav } from "./hooks/useKeyboardNav.js";
import { ScreenProvider, useScreen, type Screen } from "./hooks/useScreen.js";
import { readCredentials } from "./lib/credentials.js";
import { LeaguesScreen } from "./screens/LeaguesScreen.js";
import { TeamsScreen } from "./screens/TeamsScreen.js";
import { PlayersScreen } from "./screens/PlayersScreen.js";
import { SeasonsScreen } from "./screens/SeasonsScreen.js";
import { DivisionsScreen } from "./screens/DivisionsScreen.js";
import { DebugScreen } from "./screens/DebugScreen.js";
import { ErrorsScreen } from "./screens/ErrorsScreen.js";
import { ErrorDetailScreen } from "./screens/ErrorDetailScreen.js";
import { TeamPickerScreen } from "./screens/TeamPickerScreen.js";

const MENU_ITEMS: { label: string; screen: Screen }[] = [
  { label: "Browse leagues", screen: "leagues" },
  { label: "Browse seasons", screen: "seasons" },
  { label: "Browse divisions", screen: "divisions" },
];

function HomeScreen() {
  const [cursor, setCursor] = useState(0);
  const { push } = useScreen();

  useKeyboardNav({
    onUp: () => setCursor((c) => Math.max(0, c - 1)),
    onDown: () => setCursor((c) => Math.min(MENU_ITEMS.length - 1, c + 1)),
    onSelect: () => push(MENU_ITEMS[cursor]!.screen),
  });

  return (
    <>
      <Text>v0.4.0 — internal operator console</Text>
      <Text> </Text>
      {MENU_ITEMS.map((item, i) => (
        <Box key={item.screen}>
          <Text color={i === cursor ? "blue" : undefined}>
            {i === cursor ? "❯ " : "  "}
          </Text>
          <Text bold={i === cursor}>{item.label}</Text>
        </Box>
      ))}
    </>
  );
}

function CurrentScreen() {
  const { current } = useScreen();

  switch (current) {
    case "leagues":
      return <LeaguesScreen />;
    case "teams":
      return <TeamsScreen />;
    case "players":
      return <PlayersScreen />;
    case "seasons":
      return <SeasonsScreen />;
    case "divisions":
      return <DivisionsScreen />;
    case "debug":
      return <DebugScreen />;
    case "errors":
      return <ErrorsScreen />;
    case "error-detail":
      return <ErrorDetailScreen />;
    case "team-picker":
      return <TeamPickerScreen />;
    default:
      return <HomeScreen />;
  }
}

function AppInner() {
  const [email, setEmail] = useState<string | null>(null);
  const { current, push, back } = useScreen();

  useEffect(() => {
    readCredentials().then((creds) => {
      if (creds?.email) setEmail(creds.email);
    });
  }, []);

  useKeyboardNav({
    onDebug: () => {
      if (current === "debug") back();
      else push("debug");
    },
    onErrors: () => push("errors"),
  });

  return (
    <Layout email={email}>
      <CurrentScreen />
    </Layout>
  );
}

interface AppProps {
  initialScreen?: Screen;
}

export function App({ initialScreen }: AppProps) {
  return (
    <ScreenProvider initialScreen={initialScreen}>
      <AppInner />
    </ScreenProvider>
  );
}

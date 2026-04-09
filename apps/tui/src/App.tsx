import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { Layout } from "./components/Layout.js";
import { useKeyboardNav } from "./hooks/useKeyboardNav.js";
import { ScreenProvider, useScreen } from "./hooks/useScreen.js";
import { readCredentials } from "./lib/credentials.js";

function HomeScreen() {
  return (
    <>
      <Text>v0.4.0 — internal operator console</Text>
      <Text> </Text>
      <Text dimColor>No screens available yet. Run &quot;pnpm tui login&quot; to authenticate.</Text>
    </>
  );
}

function AppInner() {
  const [email, setEmail] = useState<string | null>(null);
  const { back } = useScreen();

  useEffect(() => {
    readCredentials().then((creds) => {
      if (creds?.email) setEmail(creds.email);
    });
  }, []);

  useKeyboardNav({
    onBack: back,
  });

  return (
    <Layout email={email}>
      <HomeScreen />
    </Layout>
  );
}

export function App() {
  return (
    <ScreenProvider>
      <AppInner />
    </ScreenProvider>
  );
}

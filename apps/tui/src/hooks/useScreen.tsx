import React, { createContext, useCallback, useContext, useState } from "react";

export type Screen = "home" | "leagues" | "league-detail" | "teams" | "players" | "seasons" | "divisions";

interface ScreenState {
  current: Screen;
  stack: Screen[];
  push: (screen: Screen) => void;
  back: () => void;
}

const ScreenContext = createContext<ScreenState | null>(null);

export function ScreenProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Screen[]>(["home"]);

  const push = useCallback((screen: Screen) => {
    setStack((prev) => [...prev, screen]);
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const current = stack[stack.length - 1]!;

  return (
    <ScreenContext value={{ current, stack, push, back }}>
      {children}
    </ScreenContext>
  );
}

export function useScreen(): ScreenState {
  const ctx = useContext(ScreenContext);
  if (!ctx) {
    throw new Error("useScreen must be used within a ScreenProvider");
  }
  return ctx;
}

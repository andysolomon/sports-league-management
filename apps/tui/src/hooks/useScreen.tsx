import React, { createContext, useCallback, useContext, useState } from "react";

export type Screen = "home" | "leagues" | "league-detail" | "teams" | "players" | "seasons" | "divisions";

export type ScreenParams = Record<string, unknown>;

interface StackEntry {
  screen: Screen;
  params: ScreenParams;
}

interface ScreenState {
  current: Screen;
  params: ScreenParams;
  stack: StackEntry[];
  push: (screen: Screen, params?: ScreenParams) => void;
  back: () => void;
}

const ScreenContext = createContext<ScreenState | null>(null);

interface ScreenProviderProps {
  children: React.ReactNode;
  initialScreen?: Screen;
  initialParams?: ScreenParams;
}

export function ScreenProvider({ children, initialScreen, initialParams }: ScreenProviderProps) {
  const [stack, setStack] = useState<StackEntry[]>(() => {
    const home: StackEntry = { screen: "home", params: {} };
    if (initialScreen && initialScreen !== "home") {
      return [home, { screen: initialScreen, params: initialParams ?? {} }];
    }
    return [home];
  });

  const push = useCallback((screen: Screen, params: ScreenParams = {}) => {
    setStack((prev) => [...prev, { screen, params }]);
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const top = stack[stack.length - 1]!;

  return (
    <ScreenContext value={{ current: top.screen, params: top.params, stack, push, back }}>
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

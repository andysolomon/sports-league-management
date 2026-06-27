"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

/**
 * Toaster wired to the app theme (WSM-000172).
 *
 * sonner's bare `<Toaster>` defaults to the light theme, so toasts rendered
 * light even in dark mode once the app moved to a system-default theme (design
 * system, WSM-000166). Pass next-themes' `resolvedTheme` so toasts track
 * light/dark — including the manual top-bar toggle. Must render inside
 * `ThemeProvider` (it reads the theme via `useTheme`).
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      richColors
      closeButton
    />
  );
}

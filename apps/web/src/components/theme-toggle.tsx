"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Never changes after mount, so the store has nothing to subscribe to.
const emptySubscribe = () => () => {};

/**
 * Dark/light toggle (WSM-000136 P1). Renders a stable icon until mounted to
 * avoid a hydration mismatch (the resolved theme is only known client-side).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // `mounted` is false during SSR and the first client render (matching the
  // server markup), then true — via useSyncExternalStore rather than a
  // setState-in-effect, so the React Compiler lint guard stays satisfied.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = resolvedTheme !== "light";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && !isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}

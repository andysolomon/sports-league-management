"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openCommandPalette } from "./command-palette";

// Platform never changes after mount, so the store has nothing to subscribe to.
const emptySubscribe = () => () => {};

/**
 * Opens the global command palette (WSM-000136 P2). Two looks:
 *  - `variant="bar"` (default): a Vercel-style "Search…  ⌘K" bar for the desktop
 *    header (the ⌘/Ctrl hint resolves per-platform after mount).
 *  - `variant="icon"`: a compact search icon button for the mobile header.
 */
export function CommandTrigger({
  variant = "bar",
}: {
  variant?: "bar" | "icon";
}) {
  // Platform is client-only. Read it through useSyncExternalStore (SSR snapshot
  // is `false`) so the ⌘/Ctrl hint resolves after hydration without a
  // setState-in-effect.
  const isMac = useSyncExternalStore(
    emptySubscribe,
    () => navigator.platform.toLowerCase().includes("mac"),
    () => false,
  );

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search"
        onClick={openCommandPalette}
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={openCommandPalette}
      className="text-muted-foreground w-56 justify-between gap-2 font-normal"
    >
      <span className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        Search…
      </span>
      <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </Button>
  );
}

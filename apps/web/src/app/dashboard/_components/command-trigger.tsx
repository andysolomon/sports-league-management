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
      className="text-text-subtle h-[38px] max-w-[360px] flex-1 justify-between gap-2 border-border bg-surface-2 font-medium hover:bg-surface-2 hover:text-text-subtle"
    >
      <span className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5" />
        Search…
      </span>
      <kbd className="text-text-subtle pointer-events-none inline-flex items-center rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] font-medium select-none">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </Button>
  );
}

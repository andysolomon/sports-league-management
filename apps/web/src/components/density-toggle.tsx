"use client";

import { useSyncExternalStore } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDensity } from "@/components/density-provider";

const emptySubscribe = () => () => {};

/**
 * Comfortable/compact density toggle (WSM-000244). Mirrors ThemeToggle's
 * mounted guard so SSR and the first client render stay aligned.
 */
export function DensityToggle() {
  const { density, toggleDensity } = useDensity();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isCompact = density === "compact";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isCompact ? "Use comfortable density" : "Use compact density"}
      title={isCompact ? "Comfortable density" : "Compact density"}
      onClick={toggleDensity}
    >
      {mounted && isCompact ? (
        <Rows3 className="h-4 w-4" />
      ) : (
        <LayoutGrid className="h-4 w-4" />
      )}
    </Button>
  );
}

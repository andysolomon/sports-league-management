"use client";

import * as React from "react";
import { GameContextDrawer } from "@/components/games/GameContextDrawer";
import type { GameDrawerProjection } from "@/lib/game-drawer-projection";
import { gameDrawerMatchupLabel } from "@/lib/game-drawer-projection";
import { cn } from "@/lib/utils";

export interface GameDrawerTriggerProps {
  projection: GameDrawerProjection;
  /** Visible trigger content (team names, card, etc.). */
  children: React.ReactNode;
  className?: string;
  /** Optional override for the trigger's accessible name. */
  ariaLabel?: string;
}

/**
 * Accessible drawer opener — keeps interactive admin controls OUTSIDE the
 * trigger so nested buttons/links do not fight the sheet (WSM-000240).
 */
export function GameDrawerTrigger({
  projection,
  children,
  className,
  ariaLabel,
}: GameDrawerTriggerProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const label =
    ariaLabel ??
    `View ${projection.status === "final" ? "final" : "preview"} for ${gameDrawerMatchupLabel(projection)}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        data-testid={`game-drawer-trigger-${projection.id}`}
        onClick={() => setOpen(true)}
        className={cn(
          "rounded-sm text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      >
        {children}
      </button>
      <GameContextDrawer
        projection={projection}
        open={open}
        onOpenChange={setOpen}
        restoreFocusRef={triggerRef}
      />
    </>
  );
}

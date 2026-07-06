"use client";

import { cn } from "@/lib/utils";
import {
  GAMECAST_LAYOUT_LABELS,
  GAMECAST_LAYOUTS,
  type GamecastLayout,
} from "./gamecast-layout";

export interface GamecastLayoutSwitcherProps {
  value: GamecastLayout;
  onChange: (layout: GamecastLayout) => void;
}

export default function GamecastLayoutSwitcher({
  value,
  onChange,
}: GamecastLayoutSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Gamecast layout"
      className="inline-flex gap-1 rounded-control bg-surface-2 p-1"
      data-testid="gamecast-layout-switcher"
    >
      {GAMECAST_LAYOUTS.map((layout) => {
        const isActive = layout === value;
        return (
          <button
            key={layout}
            type="button"
            data-testid={`gamecast-layout-${layout}`}
            aria-pressed={isActive}
            onClick={() => onChange(layout)}
            className={cn(
              "rounded-control px-3 py-1.5 text-label-14 font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-text-muted hover:bg-surface-3 hover:text-text",
            )}
          >
            {GAMECAST_LAYOUT_LABELS[layout]}
          </button>
        );
      })}
    </div>
  );
}

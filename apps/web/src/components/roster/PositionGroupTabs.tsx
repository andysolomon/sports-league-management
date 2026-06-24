"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  groupPlayersByPosition,
  OTHER_GROUP,
  type RosterGroup,
} from "@/lib/position-group";

const ALL_TAB = "All" as const;
type Tab = typeof ALL_TAB | RosterGroup;

interface Positioned {
  position: string;
  jerseyNumber?: number | null;
  name: string;
}

interface PositionGroupTabsProps<T extends Positioned> {
  players: T[];
  /** Renders the player list for the active tab (already filtered + ordered). */
  children: (players: T[], activeTab: Tab) => ReactNode;
}

/**
 * Madden-style roster navigation (WSM-000086): one tab per non-empty
 * position group in football order (QB → RB → … → K/P → Other), plus All.
 * The strip scrolls horizontally so 10 tabs survive a phone viewport.
 */
export function PositionGroupTabs<T extends Positioned>({
  players,
  children,
}: PositionGroupTabsProps<T>) {
  const [activeTab, setActiveTab] = useState<Tab>(ALL_TAB);

  const grouped = useMemo(() => groupPlayersByPosition(players), [players]);

  const tabs: Tab[] = [ALL_TAB, ...grouped.map((g) => g.group)];

  // A previously selected group can empty out after a delete — fall back.
  const effectiveTab =
    activeTab !== ALL_TAB && !grouped.some((g) => g.group === activeTab)
      ? ALL_TAB
      : activeTab;
  const activePlayers =
    effectiveTab === ALL_TAB
      ? players
      : (grouped.find((g) => g.group === effectiveTab)?.players ?? []);

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Position groups"
        className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1"
      >
        {tabs.map((tab) => {
          const count =
            tab === ALL_TAB
              ? players.length
              : (grouped.find((g) => g.group === tab)?.players.length ?? 0);
          const isActive = tab === effectiveTab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 whitespace-nowrap rounded-control px-3 py-2 text-label-14 transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text"
              }`}
            >
              {tab === OTHER_GROUP ? "Other" : tab}
              <span className="ml-1.5 text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      {children(activePlayers, effectiveTab)}
    </div>
  );
}

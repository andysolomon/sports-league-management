/*
 * Deterministic season recap composition (D4).
 *
 * This module is intentionally Convex-free. The persistence layer supplies
 * stored dynasty-event headlines; this module only orders and groups them.
 * The src/ history module re-exports it so Convex and Next share one copy.
 */

import type { NarrativeEventType } from "./narrative";

export type RecapEventType = NarrativeEventType;

export interface RecapEvent {
  id: string;
  eventType: RecapEventType;
  headline: string;
  week: number | null;
  createdAt: string;
}

export interface StorylineBlock {
  order: number;
  key: string;
  title: string;
  body: string;
  eventIds: string[];
}

export interface ComposeRecapInput {
  seasonName: string;
  events: readonly RecapEvent[];
}

interface StorylineSection {
  key: string;
  title: string;
  priority: number;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sectionFor(eventType: RecapEventType): StorylineSection {
  switch (eventType) {
    case "season_completed":
      return { key: "championship", title: "Championship", priority: 0 };
    case "game_final":
      return {
        key: "games",
        title: "Games that defined the season",
        priority: 1,
      };
    case "award_won":
      return { key: "awards", title: "Awards and honors", priority: 2 };
    case "coach_fired":
      return { key: "programs", title: "Around the programs", priority: 3 };
    case "player_injured":
      return { key: "injuries", title: "Injury report", priority: 4 };
    case "transfer_completed":
    case "transfer_retained":
      return { key: "roster", title: "Roster movement", priority: 5 };
    default: {
      const _exhaustive: never = eventType;
      void _exhaustive;
      return { key: "season", title: "Season in review", priority: 6 };
    }
  }
}

function compareEvents(a: RecapEvent, b: RecapEvent): number {
  const aWeek = a.week ?? Number.MAX_SAFE_INTEGER;
  const bWeek = b.week ?? Number.MAX_SAFE_INTEGER;
  if (aWeek !== bWeek) return aWeek - bWeek;
  const created = compareText(a.createdAt, b.createdAt);
  if (created !== 0) return created;
  return compareText(a.id, b.id);
}

function sentence(headline: string): string {
  const trimmed = headline.trim();
  if (trimmed.length === 0) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Return newspaper-style, ordered storyline blocks from stored headlines.
 *
 * Sorting happens inside the function, so callers receive byte-identical copy
 * even when an equivalent event set arrives in a different input order.
 */
export function composeRecap(input: ComposeRecapInput): StorylineBlock[] {
  const grouped = new Map<
    string,
    { section: StorylineSection; events: RecapEvent[] }
  >();

  for (const event of input.events) {
    const section = sectionFor(event.eventType);
    const group = grouped.get(section.key) ?? { section, events: [] };
    group.events.push(event);
    grouped.set(section.key, group);
  }

  if (grouped.size === 0) {
    return [
      {
        order: 0,
        key: "season",
        title: "Season in review",
        body: `${input.seasonName} is in the books.`,
        eventIds: [],
      },
    ];
  }

  return [...grouped.values()]
    .sort(
      (a, b) =>
        a.section.priority - b.section.priority ||
        compareText(a.section.key, b.section.key),
    )
    .map((group, order) => {
      const events = [...group.events].sort(compareEvents);
      return {
        order,
        key: group.section.key,
        title: group.section.title,
        body: events
          .map((event) => sentence(event.headline))
          .filter(Boolean)
          .join(" "),
        eventIds: events.map((event) => event.id),
      };
    });
}

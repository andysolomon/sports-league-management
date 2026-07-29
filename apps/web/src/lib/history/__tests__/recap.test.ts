import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  composeRecap,
  type ComposeRecapInput,
} from "@/lib/history/recap";

const INPUT: ComposeRecapInput = {
  seasonName: "2026",
  events: [
    {
      id: "event-award",
      eventType: "award_won",
      headline: "Jordan Runner earns Player of the Year honors",
      week: null,
      createdAt: "2026-12-02T00:00:00.000Z",
    },
    {
      id: "event-game-2",
      eventType: "game_final",
      headline: "Week 2: North edges South 24-21",
      week: 2,
      createdAt: "2026-09-08T00:00:00.000Z",
    },
    {
      id: "event-game-1",
      eventType: "game_final",
      headline: "Week 1: South beats North 28-14",
      week: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  ],
};

describe("composeRecap", () => {
  it("yields byte-identical copy for identical event sets", () => {
    const first = JSON.stringify(composeRecap(INPUT));
    const second = JSON.stringify(
      composeRecap({ ...INPUT, events: [...INPUT.events].reverse() }),
    );

    expect(second).toBe(first);
  });

  it("contains no AI SDK import or network generation call in the recap path", () => {
    const paths = [
      "convex/lib/recap.ts",
      "convex/lib/seasonRecaps.ts",
      "src/lib/history/recap.ts",
    ];
    const source = paths
      .map((path) => readFileSync(resolve(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /from\s+["'](?:ai|@ai-sdk\/|openai|@anthropic-ai\/)|\bfetch\s*\(|\baxios\b|\bgenerateText\b|\bstreamText\b/,
    );
  });
});

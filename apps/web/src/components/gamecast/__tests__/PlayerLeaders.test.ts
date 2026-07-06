import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PlayerLeaders from "@/components/gamecast/PlayerLeaders";
import type { StatGroupLeaders } from "@/lib/gamecast";

const homeTeam = { abbr: "WHE", color: "#3d6fe6" };
const awayTeam = { abbr: "HIL", color: "#d1503a" };

const sampleGroups: StatGroupLeaders[] = [
  {
    group: "passing",
    label: "Passing",
    home: {
      playerId: "home-qb-1",
      teamId: "home",
      statLine: {
        passing: { comp: 12, att: 18, yards: 164, td: 2, int: 0, sacked: 1 },
      },
      compactLine: "12/18, 164 yds, 2 TD",
      primaryValue: 164,
    },
    away: {
      playerId: "away-qb-1",
      teamId: "away",
      statLine: {
        passing: { comp: 9, att: 14, yards: 98, td: 1, int: 1, sacked: 0 },
      },
      compactLine: "9/14, 98 yds, 1 TD, 1 INT",
      primaryValue: 98,
    },
  },
  {
    group: "rushing",
    label: "Rushing",
    home: {
      playerId: "home-rb-1",
      teamId: "home",
      statLine: { rushing: { carries: 14, yards: 72, td: 1, long: 22 } },
      compactLine: "14 car, 72 yds, 1 TD",
      primaryValue: 72,
    },
    away: null,
  },
];

describe("PlayerLeaders", () => {
  it("renders groups with activity and player names", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerLeaders, {
        groups: sampleGroups,
        playerNameMap: {
          "home-qb-1": { name: "Jaylen Smith", position: "QB" },
          "away-qb-1": { name: "Tyler Brown", position: "QB" },
          "home-rb-1": { name: "Marcus Lee", position: "RB" },
        },
        homeTeam,
        awayTeam,
      }),
    );
    expect(html).toContain("Passing");
    expect(html).toContain("Rushing");
    expect(html).toContain("J. Smith");
    expect(html).toContain("T. Brown");
    expect(html).toContain("M. Lee");
    expect(html).toContain("12/18, 164 yds, 2 TD");
    expect(html).toContain("Stats reflect the revealed game state");
  });

  it("omits empty state message when groups exist", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerLeaders, {
        groups: sampleGroups,
        playerNameMap: {},
        homeTeam,
        awayTeam,
      }),
    );
    expect(html).not.toContain("No player stats yet");
  });

  it("shows empty state when no groups", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerLeaders, {
        groups: [],
        playerNameMap: {},
        homeTeam,
        awayTeam,
      }),
    );
    expect(html).toContain("No player stats yet");
  });

  it("uses fallback label when player missing from map", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerLeaders, {
        groups: [sampleGroups[0]],
        playerNameMap: {},
        homeTeam,
        awayTeam,
      }),
    );
    expect(html).toContain("#qb-1");
  });
});

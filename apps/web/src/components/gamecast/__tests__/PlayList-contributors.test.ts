import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { simulateGameLog, allPlays } from "@/lib/pbp";
import type { PbpGameInput, PlayerSimProfile, TeamSimProfile } from "@/lib/pbp";
import { groupPlaysByDrive } from "@/lib/gamecast";
import PlayList from "@/components/gamecast/PlayList";

function makePlayer(
  teamId: string,
  position: string,
  overall: number,
  depthRank: number,
): PlayerSimProfile {
  return {
    playerId: `${teamId}-${position}-${depthRank}`,
    position,
    overall,
    depthRank,
    positionSlot: position,
  };
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 1],
    ["RB", 2],
    ["WR", 3],
    ["TE", 1],
    ["DE", 2],
    ["LB", 2],
    ["CB", 2],
    ["K", 1],
    ["P", 1],
  ];
  const players: PlayerSimProfile[] = [];
  for (const [pos, count] of specs) {
    for (let i = 1; i <= count; i++) {
      players.push(makePlayer(teamId, pos, strength, i));
    }
  }
  return players;
}

function buildTeam(teamId: string, strength: number): TeamSimProfile {
  return { teamId, strength, players: buildRoster(teamId, strength) };
}

const log = simulateGameLog({
  home: buildTeam("home", 68),
  away: buildTeam("away", 62),
  seed: 4242,
  decisive: false,
} satisfies PbpGameInput);
const plays = allPlays(log);
const homeTeam = { name: "Home", abbr: "HOM", color: "#111" };
const awayTeam = { name: "Away", abbr: "AWY", color: "#222" };

describe("PlayList contributor line", () => {
  it("renders contributor text inside the play row button", () => {
    const passPlay = plays.find((p) => p.playType === "pass_complete");
    expect(passPlay).toBeDefined();
    const passer = passPlay!.participants.find((p) => p.role === "passer");
    expect(passer).toBeDefined();

    const map: Record<string, { name: string; position: string }> = {
      [passer!.playerId]: { name: "Test Passer", position: "QB" },
    };

    const html = renderToStaticMarkup(
      createElement(PlayList, {
        groups: groupPlaysByDrive(log, [passPlay!]),
        allPlaysFlat: plays,
        homeTeamId: log.homeTeamId,
        homeTeam,
        awayTeam,
        playIndex: plays.length,
        mode: "review",
        animate: false,
        onPlaySelect: () => {},
        playerNameMap: map,
      }),
    );

    expect(html).toContain("<button");
    expect(html).toContain("T. Passer");
    expect(html.indexOf("T. Passer")).toBeGreaterThan(html.indexOf("<button"));
  });

  it("uses role fallback when name map is empty", () => {
    const passPlay = plays.find((p) => p.playType === "pass_complete");
    expect(passPlay).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(PlayList, {
        groups: groupPlaysByDrive(log, [passPlay!]),
        allPlaysFlat: plays,
        homeTeamId: log.homeTeamId,
        homeTeam,
        awayTeam,
        playIndex: plays.length,
        mode: "review",
        animate: false,
        onPlaySelect: () => {},
        playerNameMap: {},
      }),
    );

    expect(html).toContain("QB QB-1");
  });
});

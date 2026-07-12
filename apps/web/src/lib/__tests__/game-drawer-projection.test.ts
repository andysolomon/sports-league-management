import { describe, expect, it } from "vitest";
import {
  formatTeamRecord,
  gameDrawerCanOpenGamecast,
  gameDrawerIsFinal,
  gameDrawerMatchupLabel,
  projectionFromFixture,
  projectionFromMatchup,
} from "@/lib/game-drawer-projection";
import type { PlayoffMatchupDto } from "@/lib/data-api";
import type { FixtureDto } from "@sports-management/shared-types";

const baseFixture: FixtureDto = {
  id: "fx1",
  seasonId: "s1",
  homeTeamId: "h1",
  awayTeamId: "a1",
  homeTeamName: "Alpha",
  awayTeamName: "Beta",
  scheduledAt: "2026-07-01T18:00:00.000Z",
  week: 1,
  venue: "Memorial Field",
  status: "scheduled",
  stage: "regular",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "user",
};

describe("game-drawer-projection", () => {
  it("builds a scheduled fixture preview with team records", () => {
    const records = new Map([
      ["h1", "2-1"],
      ["a1", "1-2"],
    ]);
    const projection = projectionFromFixture({
      fixture: baseFixture,
      result: null,
      hasPlayLog: false,
      recordByTeamId: records,
    });

    expect(projection.surface).toBe("schedule");
    expect(projection.status).toBe("scheduled");
    expect(projection.home.record).toBe("2-1");
    expect(projection.away.record).toBe("1-2");
    expect(projection.venue).toBe("Memorial Field");
    expect(gameDrawerIsFinal(projection)).toBe(false);
    expect(gameDrawerCanOpenGamecast(projection)).toBe(false);
  });

  it("builds a final fixture summary with gamecast availability", () => {
    const projection = projectionFromFixture({
      fixture: { ...baseFixture, status: "final" },
      result: {
        id: "r1",
        fixtureId: "fx1",
        homeScore: 21,
        awayScore: 14,
        playerStatsJson: null,
        recordedAt: "2026-01-02T00:00:00.000Z",
        recordedBy: "user",
      },
      hasPlayLog: true,
    });

    expect(projection.homeScore).toBe(21);
    expect(projection.awayScore).toBe(14);
    expect(gameDrawerIsFinal(projection)).toBe(true);
    expect(gameDrawerCanOpenGamecast(projection)).toBe(true);
    expect(gameDrawerMatchupLabel(projection)).toBe("Alpha vs Beta");
  });

  it("builds a playoff matchup projection with seeds", () => {
    const matchup: PlayoffMatchupDto = {
      id: "m1",
      round: 1,
      slot: 0,
      homeSeed: 1,
      awaySeed: 4,
      homeTeamId: "h1",
      awayTeamId: "a1",
      homeTeamName: "Alpha",
      awayTeamName: "Beta",
      winnerTeamId: "h1",
      fixtureId: "fx1",
      status: "final",
      homeScore: 28,
      awayScore: 21,
      bracketType: null,
      isBye: false,
      hasPlayLog: true,
    };

    const projection = projectionFromMatchup(matchup, "Semifinals");
    expect(projection?.roundLabel).toBe("Semifinals");
    expect(projection?.home.seed).toBe(1);
    expect(projection?.away.seed).toBe(4);
    expect(gameDrawerCanOpenGamecast(projection!)).toBe(true);
  });

  it("returns null for bye matchups", () => {
    const bye: PlayoffMatchupDto = {
      id: "bye1",
      round: 1,
      slot: 0,
      homeSeed: 1,
      awaySeed: null,
      homeTeamId: "h1",
      awayTeamId: null,
      homeTeamName: "Alpha",
      awayTeamName: null,
      winnerTeamId: "h1",
      fixtureId: null,
      status: null,
      homeScore: null,
      awayScore: null,
      bracketType: null,
      isBye: true,
      hasPlayLog: false,
    };

    expect(projectionFromMatchup(bye, "Round 1")).toBeNull();
  });

  it("formats team records with ties", () => {
    expect(formatTeamRecord(3, 1, 1)).toBe("3-1-1");
    expect(formatTeamRecord(0, 0, 0)).toBe("0-0");
  });
});

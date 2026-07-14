import { describe, expect, it } from "vitest";
import { resolveLeagueLifecycleBanner } from "@/lib/league-lifecycle-banners";

describe("resolveLeagueLifecycleBanner", () => {
  it("prefers champion banner when a champion is decided", () => {
    expect(
      resolveLeagueLifecycleBanner({
        champion: { teamId: "t1", teamName: "Home Hawks" },
        seasonName: "2026 Season",
        handoff: "start",
        progressFinal: 6,
        progressTotal: 6,
      }),
    ).toEqual({
      kind: "champion",
      teamName: "Home Hawks",
      seasonName: "2026 Season",
    });
  });

  it("shows start-playoffs handoff when regular season is final with no bracket", () => {
    expect(
      resolveLeagueLifecycleBanner({
        champion: null,
        seasonName: "2026 Season",
        handoff: "start",
        progressFinal: 6,
        progressTotal: 6,
      }),
    ).toEqual({
      kind: "playoff-handoff",
      state: "start",
      progressFinal: 6,
      progressTotal: 6,
    });
  });

  it("shows waiting handoff for non-managers when playoffs are ready", () => {
    expect(
      resolveLeagueLifecycleBanner({
        champion: null,
        seasonName: "2026 Season",
        handoff: "waiting",
        progressFinal: 3,
        progressTotal: 3,
      }),
    ).toEqual({
      kind: "playoff-handoff",
      state: "waiting",
      progressFinal: 3,
      progressTotal: 3,
    });
  });

  it("returns null when no banner applies", () => {
    expect(
      resolveLeagueLifecycleBanner({
        champion: null,
        seasonName: "2026 Season",
        handoff: "hidden",
        progressFinal: 0,
        progressTotal: 0,
      }),
    ).toBeNull();
  });

  it("skips champion banner when season name is unavailable", () => {
    expect(
      resolveLeagueLifecycleBanner({
        champion: { teamId: "t1", teamName: "Home Hawks" },
        seasonName: null,
        handoff: "hidden",
        progressFinal: 0,
        progressTotal: 0,
      }),
    ).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import {
  OFFERS_PER_TRANSFER,
  generateTransferSlate,
  matchTransfersIn,
  transferOutLikelihood,
  type DestinationTeam,
  type TransferCandidate,
} from "@/lib/dynasty/transfers";
import { MAX_TARGET_ROSTER_SIZE } from "../../../../convex/lib/offseason";

function candidate(over: Partial<TransferCandidate> = {}): TransferCandidate {
  return {
    playerId: "player_1",
    teamId: "team_1",
    position: "WR",
    depthRank: 1,
    overall: 75,
    grade: 11,
    status: "active",
    ...over,
  };
}

describe("transferOutLikelihood", () => {
  it("makes a buried player likelier to leave than an identical starter", () => {
    /*
     * The user story in one assertion. Everything else in this module exists to
     * produce this shape.
     */
    const starter = transferOutLikelihood({
      depthRank: 1,
      overall: 85,
      grade: 11,
      volume: "normal",
    });
    const buried = transferOutLikelihood({
      depthRank: 4,
      overall: 85,
      grade: 11,
      volume: "normal",
    });
    expect(buried).toBeGreaterThan(starter);
  });

  it("makes a buried GOOD player likelier than a buried bad one", () => {
    /*
     * Talent and burial multiply. If they merely added, a benchwarming
     * 50-overall would be as likely to move as a benchwarming 90-overall, and
     * the window would fill with players nobody wants.
     */
    const good = transferOutLikelihood({
      depthRank: 4,
      overall: 90,
      grade: 11,
      volume: "normal",
    });
    const bad = transferOutLikelihood({
      depthRank: 4,
      overall: 50,
      grade: 11,
      volume: "normal",
    });
    expect(good).toBeGreaterThan(bad * 2);
  });

  it("never lets a senior enter the window", () => {
    // He is graduating. "Might transfer" is not a quieter version of that
    // story — it is one that cannot happen.
    expect(
      transferOutLikelihood({
        depthRank: 5,
        overall: 95,
        grade: 12,
        volume: "high",
      }),
    ).toBe(0);
  });

  it("scales with the volume knob without changing the ordering", () => {
    const at = (volume: "low" | "normal" | "high") =>
      transferOutLikelihood({
        depthRank: 4,
        overall: 80,
        grade: 11,
        volume,
      });
    expect(at("low")).toBeLessThan(at("normal"));
    expect(at("normal")).toBeLessThan(at("high"));
  });

  it("stays inside [0, 1] at every extreme", () => {
    for (const depthRank of [1, 2, 5, 40]) {
      for (const overall of [40, 70, 99]) {
        for (const grade of [9, 10, 11, 12, null]) {
          const value = transferOutLikelihood({
            depthRank,
            overall,
            grade,
            volume: "high",
          });
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("generateTransferSlate", () => {
  const roster = Array.from({ length: 40 }, (_, i) =>
    candidate({
      playerId: `player_${i}`,
      depthRank: (i % 5) + 1,
      overall: 55 + (i % 40),
      grade: [9, 10, 11][i % 3],
    }),
  );

  it("is deterministic for a fixed season", () => {
    // Re-running the window must not reroll until the commissioner likes it,
    // and it is what makes the generating mutation safe to retry.
    const first = generateTransferSlate({
      seasonId: "season_1",
      candidates: roster,
      volume: "normal",
      enabled: true,
    });
    const second = generateTransferSlate({
      seasonId: "season_1",
      candidates: roster,
      volume: "normal",
      enabled: true,
    });
    expect(second).toEqual(first);
  });

  it("produces a different slate in a different season", () => {
    const a = generateTransferSlate({
      seasonId: "season_a",
      candidates: roster,
      volume: "high",
      enabled: true,
    });
    const b = generateTransferSlate({
      seasonId: "season_b",
      candidates: roster,
      volume: "high",
      enabled: true,
    });
    expect(b.map((t) => t.playerId)).not.toEqual(a.map((t) => t.playerId));
  });

  it("never touches a graduated player", () => {
    /*
     * Checked on status, not on grade. The two can disagree — the rollover
     * marks seniors graduated and leaves their grade at 12, and a hand-edited
     * league can produce either without the other.
     */
    const graduated = Array.from({ length: 60 }, (_, i) =>
      candidate({
        playerId: `grad_${i}`,
        depthRank: 5,
        overall: 95,
        grade: 11,
        status: "graduated",
      }),
    );
    const slate = generateTransferSlate({
      seasonId: "season_1",
      candidates: graduated,
      volume: "high",
      enabled: true,
    });
    expect(slate).toEqual([]);
  });

  it("ignores anyone who is not active", () => {
    const inactive = Array.from({ length: 40 }, (_, i) =>
      candidate({
        playerId: `inactive_${i}`,
        depthRank: 5,
        overall: 90,
        status: "free_agent",
      }),
    );
    expect(
      generateTransferSlate({
        seasonId: "season_1",
        candidates: inactive,
        volume: "high",
        enabled: true,
      }),
    ).toEqual([]);
  });

  it("produces nothing at all when transfers are switched off", () => {
    // The kill switch has to be total. A slate of one is still a panel a
    // commissioner has to work through.
    expect(
      generateTransferSlate({
        seasonId: "season_1",
        candidates: roster,
        volume: "high",
        enabled: false,
      }),
    ).toEqual([]);
  });

  it("moves fewer players on low volume than on high", () => {
    const count = (volume: "low" | "high") =>
      generateTransferSlate({
        seasonId: "season_vol",
        candidates: roster,
        volume,
        enabled: true,
      }).length;
    expect(count("low")).toBeLessThan(count("high"));
  });

  it("puts the likeliest mover first", () => {
    const slate = generateTransferSlate({
      seasonId: "season_1",
      candidates: roster,
      volume: "high",
      enabled: true,
    });
    const likelihoods = slate.map((t) => t.likelihood);
    expect([...likelihoods].sort((a, b) => b - a)).toEqual(likelihoods);
  });
});

describe("matchTransfersIn", () => {
  const outbound = [
    {
      playerId: "player_1",
      fromTeamId: "team_1",
      position: "WR",
      likelihood: 0.4,
      reason: "buried" as const,
    },
  ];

  function destinations(over: Partial<DestinationTeam>[] = []): DestinationTeam[] {
    const base: DestinationTeam[] = [
      { teamId: "team_1", rosterCount: 40, countAtPosition: 5 },
      { teamId: "team_2", rosterCount: 40, countAtPosition: 1 },
      { teamId: "team_3", rosterCount: 40, countAtPosition: 6 },
      { teamId: "team_4", rosterCount: 40, countAtPosition: 2 },
    ];
    return base.map((team, i) => ({ ...team, ...(over[i] ?? {}) }));
  }

  it("never offers a player back to the team he is leaving", () => {
    const offers = matchTransfersIn({
      seasonId: "season_1",
      outbound,
      destinationsFor: () => destinations(),
    });
    expect(offers.every((o) => o.toTeamId !== "team_1")).toBe(true);
  });

  it("prefers the programs thinnest at his position", () => {
    // A transfer that lands where nobody plays his spot is a roster move, not
    // a story.
    const offers = matchTransfersIn({
      seasonId: "season_1",
      outbound,
      destinationsFor: () => destinations(),
    });
    expect(offers).toHaveLength(OFFERS_PER_TRANSFER);
    expect(offers.map((o) => o.toTeamId).sort()).toEqual(["team_2", "team_4"]);
  });

  it("never offers a spot on a full roster", () => {
    /*
     * The roster cap, enforced at the point the offer is MADE. Without it the
     * panel would show a coach an offer that acceptance can only refuse.
     */
    const offers = matchTransfersIn({
      seasonId: "season_1",
      outbound,
      destinationsFor: () =>
        destinations().map((team) => ({
          ...team,
          rosterCount: MAX_TARGET_ROSTER_SIZE,
        })),
    });
    expect(offers).toEqual([]);
  });

  it("keeps every destination under the cap across a whole slate", () => {
    /*
     * Property check over a randomised league: transfers are CONSERVED, so
     * accepting every offer can only move headcount between teams, and no
     * team that started under the cap can be pushed over it by an offer this
     * function made.
     */
    const teams = Array.from({ length: 12 }, (_, i) => ({
      teamId: `team_${i}`,
      rosterCount: 40 + (i % 21),
      countAtPosition: i % 7,
    }));
    const slate = Array.from({ length: 30 }, (_, i) => ({
      playerId: `player_${i}`,
      fromTeamId: `team_${i % 12}`,
      position: "WR",
      likelihood: 0.3,
      reason: "buried" as const,
    }));
    const offers = matchTransfersIn({
      seasonId: "season_prop",
      outbound: slate,
      destinationsFor: () => teams,
    });
    const byTeam = new Map(teams.map((t) => [t.teamId, t.rosterCount]));
    for (const offer of offers) {
      expect(byTeam.get(offer.toTeamId)!).toBeLessThan(MAX_TARGET_ROSTER_SIZE);
      expect(offer.toTeamId).not.toBe(offer.fromTeamId);
    }
  });

  it("is deterministic per season", () => {
    const run = () =>
      matchTransfersIn({
        seasonId: "season_1",
        outbound,
        destinationsFor: () => destinations(),
      });
    expect(run()).toEqual(run());
  });

  it("breaks position ties differently for different players", () => {
    // Without the seeded jitter, a league whose teams all carry three
    // receivers would send every outbound receiver to whichever team sorts
    // first.
    const flat = () => [
      { teamId: "team_2", rosterCount: 40, countAtPosition: 3 },
      { teamId: "team_3", rosterCount: 40, countAtPosition: 3 },
      { teamId: "team_4", rosterCount: 40, countAtPosition: 3 },
    ];
    const picks = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const offers = matchTransfersIn({
        seasonId: "season_1",
        outbound: [{ ...outbound[0], playerId: `p_${i}` }],
        destinationsFor: flat,
      });
      picks.add(offers.map((o) => o.toTeamId).join(","));
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});

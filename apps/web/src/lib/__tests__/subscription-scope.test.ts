import { describe, it, expect } from "vitest";
import type { OrgContext } from "../org-context";
import { teamsInScope, playersInScope } from "../subscription-scope";

function ctx(scopes: Record<string, string[]>): OrgContext {
  return {
    userId: "u",
    orgIds: [],
    visibleLeagueIds: [],
    subscribedLeagueIds: [],
    subscriptionTeamScopes: scopes,
  };
}

const teams = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
const players = [
  { teamId: "t1" },
  { teamId: "t2" },
  { teamId: "t3" },
];

describe("teamsInScope (WSM-000100)", () => {
  it("returns all teams when the league has no scope (import all)", () => {
    expect(teamsInScope(teams, "lg", ctx({}))).toEqual(teams);
  });

  it("filters to the imported teams when scoped", () => {
    const out = teamsInScope(teams, "lg", ctx({ lg: ["t1", "t3"] }));
    expect(out.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("an empty scope is treated as import-all, not import-none", () => {
    expect(teamsInScope(teams, "lg", ctx({ lg: [] }))).toEqual(teams);
  });

  it("only the named league is scoped", () => {
    expect(teamsInScope(teams, "other", ctx({ lg: ["t1"] }))).toEqual(teams);
  });
});

describe("playersInScope (WSM-000100)", () => {
  it("returns all players when unscoped", () => {
    expect(playersInScope(players, "lg", ctx({}))).toEqual(players);
  });

  it("filters players by their team's membership in the scope", () => {
    const out = playersInScope(players, "lg", ctx({ lg: ["t2"] }));
    expect(out.map((p) => p.teamId)).toEqual(["t2"]);
  });
});

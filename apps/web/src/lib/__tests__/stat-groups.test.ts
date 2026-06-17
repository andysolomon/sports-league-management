import { describe, it, expect } from "vitest";
import {
  STAT_GROUPS,
  STAT_GROUP_BY_KEY,
  defaultGroupsFor,
} from "../stat-groups";

describe("STAT_GROUPS", () => {
  it("covers the eight box-score groups, each with fields", () => {
    expect(STAT_GROUPS.map((g) => g.key)).toEqual([
      "passing",
      "rushing",
      "receiving",
      "defense",
      "kicking",
      "punting",
      "returns",
      "ballSecurity",
    ]);
    for (const g of STAT_GROUPS) expect(g.fields.length).toBeGreaterThan(0);
  });

  it("indexes every group by key", () => {
    for (const g of STAT_GROUPS) expect(STAT_GROUP_BY_KEY[g.key]).toBe(g);
  });
});

describe("defaultGroupsFor", () => {
  it("surfaces position-relevant groups", () => {
    expect(defaultGroupsFor("QB")).toEqual(["passing", "rushing"]);
    expect(defaultGroupsFor("RB")).toEqual(["rushing", "receiving", "ballSecurity"]);
    expect(defaultGroupsFor("DB")).toEqual(["defense"]);
    expect(defaultGroupsFor("K/P")).toEqual(["kicking", "punting"]);
  });

  it("returns none for OL, unknown, or null (user adds groups)", () => {
    expect(defaultGroupsFor("OL")).toEqual([]);
    expect(defaultGroupsFor("Other")).toEqual([]);
    expect(defaultGroupsFor(null)).toEqual([]);
  });
});

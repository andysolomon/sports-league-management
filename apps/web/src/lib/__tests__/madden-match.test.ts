import { describe, it, expect } from "vitest";
import {
  normalizeName,
  normalizeTeam,
  rosterMatchKey,
} from "../madden/match";

describe("normalizeName (WSM-000095)", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeName("Ja'Marr Chase")).toBe("jamarr chase");
  });

  it("drops generational suffixes so Jr./Sr. variants align", () => {
    expect(normalizeName("Michael Pittman Jr.")).toBe("michael pittman");
    expect(normalizeName("Michael Pittman")).toBe("michael pittman");
  });

  it("collapses whitespace", () => {
    expect(normalizeName("  Josh   Allen ")).toBe("josh allen");
  });
});

describe("normalizeTeam (WSM-000095)", () => {
  it("normalizes case and spacing", () => {
    expect(normalizeTeam("Buffalo Bills")).toBe("buffalo bills");
  });
});

describe("rosterMatchKey (WSM-000095)", () => {
  it("joins normalized name and team", () => {
    expect(rosterMatchKey("Josh Allen", "Buffalo Bills")).toBe(
      "josh allen|buffalo bills",
    );
  });

  it("produces the same key for suffix and punctuation variants", () => {
    expect(rosterMatchKey("Ja'Marr Chase", "Cincinnati Bengals")).toBe(
      rosterMatchKey("JaMarr Chase", "Cincinnati Bengals"),
    );
  });
});

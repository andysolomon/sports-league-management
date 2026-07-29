import { describe, expect, it } from "vitest";
import {
  DEFENSE_SCHEME_LIST,
  OFFENSE_SCHEME_LIST,
  schemeFit,
  type SchemeFitRoster,
} from "@/lib/program/schemes";
import {
  GAMEPLAN_FOCUS_OPTIONS,
  NEUTRAL_GAMEPLAN_MODIFIERS,
  gameplanModifiers,
} from "@/lib/program/gameplan";
import { NEUTRAL_SCHEME_MODIFIERS } from "@/lib/pbp/schemes";

const EMPTY: SchemeFitRoster = { players: [] };
const UNRATED: SchemeFitRoster = {
  players: [{ position: "WR" }, { position: "RB" }],
};

describe("schemeFit", () => {
  it("returns [0, 1] for every scheme and roster pair, including degenerate rosters", () => {
    const rosters = [EMPTY, UNRATED];
    for (const spec of OFFENSE_SCHEME_LIST) {
      for (const roster of rosters) {
        const fit = schemeFit(spec.id, roster);
        expect(fit).toBeGreaterThanOrEqual(0);
        expect(fit).toBeLessThanOrEqual(1);
        expect(Number.isNaN(fit)).toBe(false);
      }
    }
    for (const spec of DEFENSE_SCHEME_LIST) {
      for (const roster of rosters) {
        const fit = schemeFit(spec.id, roster);
        expect(fit).toBeGreaterThanOrEqual(0);
        expect(fit).toBeLessThanOrEqual(1);
        expect(Number.isNaN(fit)).toBe(false);
      }
    }
  });

  it("ranks flexbone above air raid for a power-run roster and the reverse for receivers", () => {
    const powerRun: SchemeFitRoster = {
      players: [
        { position: "RB", weightLbs: 235, overall: 80 },
        { position: "FB", weightLbs: 250, overall: 78 },
        { position: "RB", weightLbs: 228, overall: 76 },
        { position: "WR", overall: 70 },
      ],
    };
    const airRaidRoster: SchemeFitRoster = {
      players: [
        { position: "WR", overall: 88 },
        { position: "WR", overall: 86 },
        { position: "WR", overall: 84 },
        { position: "WR", overall: 82 },
        { position: "QB", overall: 90 },
      ],
    };

    expect(schemeFit("flexbone", powerRun)).toBeGreaterThan(
      schemeFit("air_raid", powerRun),
    );
    expect(schemeFit("air_raid", airRaidRoster)).toBeGreaterThan(
      schemeFit("flexbone", airRaidRoster),
    );
  });
});

describe("gameplanModifiers", () => {
  it("is exactly neutral when focus is absent", () => {
    expect(gameplanModifiers(undefined, { defenseScheme: "four_two_five" })).toEqual(
      NEUTRAL_GAMEPLAN_MODIFIERS,
    );
    expect(gameplanModifiers(null, undefined)).toEqual(NEUTRAL_GAMEPLAN_MODIFIERS);
    expect(gameplanModifiers("balanced", { defenseScheme: "forty_six" })).toEqual(
      NEUTRAL_GAMEPLAN_MODIFIERS,
    );
    expect(NEUTRAL_GAMEPLAN_MODIFIERS).toEqual(NEUTRAL_SCHEME_MODIFIERS);
  });

  it("covers every focus option without leaving the identity contract", () => {
    for (const focus of GAMEPLAN_FOCUS_OPTIONS) {
      const mods = gameplanModifiers(focus, { defenseScheme: "balanced" });
      expect(mods.passRateDelta).toEqual(expect.any(Number));
      expect(mods.tempo).toEqual(expect.any(Number));
      expect(Number.isFinite(mods.explosiveRate)).toBe(true);
    }
  });
});

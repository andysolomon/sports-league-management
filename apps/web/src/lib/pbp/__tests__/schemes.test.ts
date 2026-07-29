import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { simulateGameLog } from "../engine";
import {
  NEUTRAL_SCHEME_MODIFIERS,
  isNeutralScheme,
  schemeModifiers,
  type TeamSchemeProfile,
} from "../schemes";
import { fourthDownDecision } from "../situational";
import {
  DEFENSE_SCHEME_LIST,
  OFFENSE_SCHEME_LIST,
  defenseTendencies,
  offenseTendencies,
} from "@/lib/program/schemes";
import type {
  PbpGameInput,
  PlayerSimProfile,
  TeamSimProfile,
} from "../types";
import golden from "./fixtures/v1-golden-logs.json";

/*
 * Schemes (Dynasty Mode A6).
 *
 * The invariant that carries the slice is NEUTRALITY: a league that has
 * assigned no schemes must get the pre-A6 game, byte-for-byte. Everything else
 * here is about proving the mechanic does something once it IS assigned —
 * because a scheme system nobody can see in a box score is not worth the code.
 */

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 2],
    ["RB", 3],
    ["WR", 5],
    ["TE", 2],
    ["DE", 2],
    ["DT", 2],
    ["OLB", 2],
    ["MLB", 2],
    ["CB", 3],
    ["S", 2],
    ["K", 1],
    ["P", 1],
  ];
  const players: PlayerSimProfile[] = [];
  for (const [pos, count] of specs) {
    for (let i = 1; i <= count; i++) {
      const jitter = ((i * 7 + strength) % 11) - 5;
      players.push({
        playerId: `${teamId}-${pos}-${i}`,
        position: pos,
        overall: clamp(strength + jitter, 40, 99),
        depthRank: i,
        positionSlot: pos,
      });
    }
  }
  return players;
}

function buildTeam(
  teamId: string,
  strength: number,
  scheme?: TeamSchemeProfile,
): TeamSimProfile {
  return {
    teamId,
    strength,
    players: buildRoster(teamId, strength),
    ...(scheme ? { scheme } : {}),
  };
}

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Production-shaped gates: everything on, which is what a real league plays. */
const ALL_GATES = {
  scoringV2: true,
  penalties: true,
  situational: true,
  balance: true,
  injuries: true,
  schemes: true,
} as const;

describe("scheme catalog", () => {
  it("has a neutral default, and only one", () => {
    const neutralOffense = OFFENSE_SCHEME_LIST.filter((s) =>
      Object.values(s.tendencies).every((v) => v === 0),
    );
    const neutralDefense = DEFENSE_SCHEME_LIST.filter((s) =>
      Object.values(s.tendencies).every((v) => v === 0),
    );
    expect(neutralOffense.map((s) => s.id)).toEqual(["balanced"]);
    expect(neutralDefense.map((s) => s.id)).toEqual(["balanced"]);
  });

  it("keeps every tendency inside the -1..+1 axis it is defined on", () => {
    for (const spec of OFFENSE_SCHEME_LIST) {
      for (const value of Object.values(spec.tendencies)) {
        expect(Math.abs(value)).toBeLessThanOrEqual(1);
      }
    }
    for (const spec of DEFENSE_SCHEME_LIST) {
      for (const value of Object.values(spec.tendencies)) {
        expect(Math.abs(value)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("resolves an unknown or absent scheme to neutral rather than throwing", () => {
    // A misspelled scheme in the database must degrade to "no scheme". Throwing
    // here would take down a season simulation over a typo in a settings form.
    expect(offenseTendencies("not_a_scheme")).toEqual(
      offenseTendencies("balanced"),
    );
    expect(offenseTendencies(undefined)).toEqual(offenseTendencies("balanced"));
    expect(offenseTendencies(null)).toEqual(offenseTendencies("balanced"));
    expect(defenseTendencies("also_not_a_scheme")).toEqual(
      defenseTendencies("balanced"),
    );
  });
});

describe("schemeModifiers", () => {
  it("is the exact identity for absent schemes", () => {
    expect(schemeModifiers(undefined, undefined)).toEqual(
      NEUTRAL_SCHEME_MODIFIERS,
    );
  });

  it("is the exact identity for two balanced schemes", () => {
    const mods = schemeModifiers(
      { offense: "balanced", defense: "balanced" },
      { offense: "balanced", defense: "balanced" },
    );
    expect(mods).toEqual(NEUTRAL_SCHEME_MODIFIERS);
    expect(isNeutralScheme(mods)).toBe(true);
  });

  it("is the exact identity for neutral 50 dials", () => {
    // 50 is the neutral dial. It must produce EXACTLY 1, not 0.9999999999,
    // because the engine multiplies by these and relies on 1 being exact.
    const mods = schemeModifiers(
      { tempo: 50, blitzRate: 50 },
      { tempo: 50, blitzRate: 50 },
    );
    expect(mods).toEqual(NEUTRAL_SCHEME_MODIFIERS);
  });

  it("covers every scheme pairing without leaving a sane band", () => {
    for (const off of OFFENSE_SCHEME_LIST) {
      for (const def of DEFENSE_SCHEME_LIST) {
        const mods = schemeModifiers(
          { offense: off.id },
          { defense: def.id },
        );
        expect(Math.abs(mods.passRateDelta)).toBeLessThanOrEqual(0.4);
        expect(mods.tempo).toBeGreaterThan(0.5);
        expect(mods.tempo).toBeLessThan(1.5);
        for (const key of [
          "explosiveRate",
          "sackRate",
          "passAccuracy",
          "interceptionRate",
          "rushYards",
          "fumbleRate",
        ] as const) {
          expect(mods[key]).toBeGreaterThan(0.4);
          expect(mods[key]).toBeLessThan(2);
        }
      }
    }
  });

  it("reads only the offensive half of the offense and the defensive half of the defense", () => {
    // A team runs an Air Raid AND a 46. Neither should leak into the other's
    // half of the matchup.
    const airRaidAnd46: TeamSchemeProfile = {
      offense: "air_raid",
      defense: "forty_six",
    };
    const withDefenseNoise: TeamSchemeProfile = {
      offense: "air_raid",
      defense: "four_two_five",
    };
    expect(
      schemeModifiers(airRaidAnd46, { defense: "balanced" }),
    ).toEqual(schemeModifiers(withDefenseNoise, { defense: "balanced" }));
  });

  it("makes the Flexbone run and the Air Raid throw", () => {
    const flexbone = schemeModifiers({ offense: "flexbone" }, undefined);
    const airRaid = schemeModifiers({ offense: "air_raid" }, undefined);
    expect(flexbone.passRateDelta).toBeLessThan(0);
    expect(airRaid.passRateDelta).toBeGreaterThan(0);
  });

  it("lets a stacked box push an offense off the run", () => {
    // The interesting behavior: the DEFENSE changes what the offense calls.
    const vsLightBox = schemeModifiers(undefined, { defense: "four_two_five" });
    const vsStackedBox = schemeModifiers(undefined, { defense: "forty_six" });
    expect(vsStackedBox.passRateDelta).toBeGreaterThan(vsLightBox.passRateDelta);
    expect(vsStackedBox.rushYards).toBeLessThan(vsLightBox.rushYards);
  });

  it("makes the blitz a gamble, not a free upgrade", () => {
    const vsBlitz = schemeModifiers(undefined, { defense: "forty_six" });
    expect(vsBlitz.sackRate).toBeGreaterThan(1);
    // ...and quick tempo blunts it, which is why an Air Raid is not just food
    // for a blitzing defense.
    const quickVsBlitz = schemeModifiers(
      { offense: "air_raid" },
      { defense: "forty_six" },
    );
    expect(quickVsBlitz.sackRate).toBeLessThan(vsBlitz.sackRate);
  });

  it("treats the dials as overrides on the scheme's own axis", () => {
    const base = schemeModifiers(undefined, { defense: "balanced" });
    const heavy = schemeModifiers(undefined, {
      defense: "balanced",
      blitzRate: 100,
    });
    const light = schemeModifiers(undefined, {
      defense: "balanced",
      blitzRate: 0,
    });
    expect(heavy.sackRate).toBeGreaterThan(base.sackRate);
    expect(light.sackRate).toBeLessThan(base.sackRate);
  });

  it("ignores a non-finite dial instead of producing NaN", () => {
    const mods = schemeModifiers(
      { tempo: Number.NaN },
      { blitzRate: Number.POSITIVE_INFINITY },
    );
    expect(mods).toEqual(NEUTRAL_SCHEME_MODIFIERS);
  });
});

describe("scheme neutrality in the engine", () => {
  for (const c of golden.cases) {
    it(`"${c.name}" is byte-identical with the gate on but no schemes assigned`, () => {
      const input: PbpGameInput = {
        home: buildTeam("home", c.homeStrength),
        away: buildTeam("away", c.awayStrength),
        seed: c.seed,
        decisive: c.decisive,
        flavor: c.flavor as PbpGameInput["flavor"],
      };
      // The gate is ON. Nothing is assigned. The log must not move.
      const gated = simulateGameLog({ ...input, features: { schemes: true } });
      const ungated = simulateGameLog(input);
      expect(gated.drives).toEqual(ungated.drives);
      expect(gated.homeScore).toBe(ungated.homeScore);
      expect(gated.awayScore).toBe(ungated.awayScore);
    });
  }

  it("is byte-identical when both teams are explicitly balanced", () => {
    const c = golden.cases[0]!;
    const balanced: TeamSchemeProfile = {
      offense: "balanced",
      defense: "balanced",
      tempo: 50,
      blitzRate: 50,
    };
    const withSchemes = simulateGameLog({
      home: buildTeam("home", c.homeStrength, balanced),
      away: buildTeam("away", c.awayStrength, balanced),
      seed: c.seed,
      decisive: c.decisive,
      flavor: c.flavor as PbpGameInput["flavor"],
      features: { schemes: true },
    });
    expect(sha(withSchemes.drives)).toBe(sha(golden.cases[0]!.log!.drives));
  });

  it("ignores assigned schemes entirely while the gate is off", () => {
    // A league that assigns schemes and then switches the mechanic off must
    // get the old game back — the assignment becomes a stated preference
    // nobody is acting on, not a hidden effect.
    const c = golden.cases[0]!;
    const airRaid: TeamSchemeProfile = { offense: "air_raid", defense: "forty_six" };
    const off = simulateGameLog({
      home: buildTeam("home", c.homeStrength, airRaid),
      away: buildTeam("away", c.awayStrength, airRaid),
      seed: c.seed,
      decisive: c.decisive,
      flavor: c.flavor as PbpGameInput["flavor"],
    });
    expect(sha(off)).toBe(c.sha256);
  });

  it("diverges once a scheme is assigned — proving the wiring is real", () => {
    const c = golden.cases[0]!;
    const base = simulateGameLog({
      home: buildTeam("home", c.homeStrength),
      away: buildTeam("away", c.awayStrength),
      seed: c.seed,
      features: { schemes: true },
    });
    const flexbone = simulateGameLog({
      home: buildTeam("home", c.homeStrength, { offense: "flexbone" }),
      away: buildTeam("away", c.awayStrength),
      seed: c.seed,
      features: { schemes: true },
    });
    expect(sha(flexbone)).not.toBe(sha(base));
  });

  it("records the gate on the log only when it was on", () => {
    const c = golden.cases[0]!;
    const input = {
      home: buildTeam("home", c.homeStrength),
      away: buildTeam("away", c.awayStrength),
      seed: c.seed,
    };
    expect(simulateGameLog({ ...input, features: { schemes: true } }).features)
      .toEqual({ schemes: true });
    expect("features" in simulateGameLog(input)).toBe(false);
  });
});

/** Rush share across a seeded sample of games, offense-side only. */
function rushShare(
  offenseScheme: TeamSchemeProfile | undefined,
  games = 120,
): number {
  let rushes = 0;
  let dropbacks = 0;
  for (let seed = 1; seed <= games; seed++) {
    const log = simulateGameLog({
      home: buildTeam("home", 70, offenseScheme),
      away: buildTeam("away", 70),
      seed,
      features: ALL_GATES,
    });
    for (const drive of log.drives) {
      for (const play of drive.plays) {
        if (play.offenseTeamId !== "home") continue;
        if (play.playType === "rush") rushes += 1;
        else if (
          play.playType === "pass_complete" ||
          play.playType === "pass_incomplete" ||
          play.playType === "interception" ||
          play.playType === "sack"
        ) {
          dropbacks += 1;
        }
      }
    }
  }
  return rushes / (rushes + dropbacks);
}

describe("scheme distribution", () => {
  it("makes a Flexbone run materially more than an Air Raid", () => {
    // Same roster, same seeds, same opponent — the ONLY difference is what
    // they run. The stated margin is 15 percentage points; the observed gap at
    // the catalog values is far wider, and the margin is what future tuning
    // must not fall below.
    const flexbone = rushShare({ offense: "flexbone" });
    const airRaid = rushShare({ offense: "air_raid" });
    expect(flexbone - airRaid).toBeGreaterThan(0.15);
  });

  it("leaves a balanced offense between the two", () => {
    const neutral = rushShare(undefined);
    expect(neutral).toBeGreaterThan(rushShare({ offense: "air_raid" }));
    expect(neutral).toBeLessThan(rushShare({ offense: "flexbone" }));
  });

  /*
   * ── Balance ────────────────────────────────────────────────────────────────
   *
   * The A1 band — 30-60 mean points a game — is a property of the DEFAULT
   * configuration, and A6 leaves that byte-identical (see the neutrality suite
   * above). Requiring every scheme pairing to sit inside it would be requiring
   * the mechanic to do nothing: two option teams grinding out a 16-10 game is
   * the mechanic WORKING, not a regression.
   *
   * So the balance assertions here are:
   *
   *   1. a league where teams run varied schemes still averages inside the band;
   *   2. no single pairing moves scoring more than 25% off the no-scheme
   *      baseline, which is what stops a future tuning pass from turning a
   *      scheme into a cheat code.
   */
  const REPRESENTATIVE_PAIRINGS: Array<[TeamSchemeProfile, TeamSchemeProfile]> = [
    [
      { offense: "air_raid", defense: "four_two_five" },
      { offense: "flexbone", defense: "forty_six" },
    ],
    [
      { offense: "spread", defense: "three_four" },
      { offense: "wing_t", defense: "four_three" },
    ],
    [
      { offense: "pro_style", defense: "four_three" },
      { offense: "air_raid", defense: "forty_six" },
    ],
    // Both extremes playing themselves — the widest this mechanic can swing.
    [
      { offense: "flexbone", defense: "forty_six" },
      { offense: "flexbone", defense: "forty_six" },
    ],
    [
      { offense: "air_raid", defense: "four_two_five" },
      { offense: "air_raid", defense: "four_two_five" },
    ],
  ];

  function meanPoints(
    homeScheme: TeamSchemeProfile | undefined,
    awayScheme: TeamSchemeProfile | undefined,
    games = 150,
  ): number {
    let total = 0;
    for (let seed = 1; seed <= games; seed++) {
      const log = simulateGameLog({
        home: buildTeam("home", 70, homeScheme),
        away: buildTeam("away", 70, awayScheme),
        seed,
        features: ALL_GATES,
      });
      total += log.homeScore + log.awayScore;
    }
    return total / games;
  }

  it("keeps a league of varied schemes inside the 30-60 band", () => {
    const means = REPRESENTATIVE_PAIRINGS.map(([h, a]) => meanPoints(h, a));
    const league = means.reduce((a, b) => a + b, 0) / means.length;
    expect(league).toBeGreaterThanOrEqual(30);
    expect(league).toBeLessThanOrEqual(60);
  });

  it("never moves a matchup more than 25% off the no-scheme baseline", () => {
    // The guard against a scheme becoming a cheat code. Measured against the
    // engine's own output for the same rosters and seeds, so it stays true if
    // the baseline itself is later retuned.
    const baseline = meanPoints(undefined, undefined);
    for (const [homeScheme, awayScheme] of REPRESENTATIVE_PAIRINGS) {
      const mean = meanPoints(homeScheme, awayScheme);
      expect(Math.abs(mean - baseline) / baseline).toBeLessThan(0.25);
    }
  });

  it("never moves a matchup more than 25% off baseline with gameplans layered on", () => {
    const baseline = meanPoints(undefined, undefined);
    const focus = "attack_pass" as const;
    let total = 0;
    const games = 6;
    for (let seed = 1; seed <= games; seed++) {
      const log = simulateGameLog({
        home: {
          ...buildTeam("home", 70, { offense: "spread" }),
          gameplan: focus,
        },
        away: buildTeam("away", 70, { defense: "three_four" }),
        seed,
        features: ALL_GATES,
      });
      total += log.homeScore + log.awayScore;
    }
    const meanWithPlan = total / games;
    expect(Math.abs(meanWithPlan - baseline) / baseline).toBeLessThan(0.25);
  });
});

describe("coach aggression", () => {
  it("goes for it more often the bolder the coach", () => {
    // The A3 chart already took an aggression input; A6 is what finally gives
    // a league a way to set it. This pins the direction so a future tuning
    // pass cannot invert it unnoticed.
    const situations = [
      { yardsToGo: 2, yardsToGoal: 45 },
      { yardsToGo: 3, yardsToGoal: 38 },
      { yardsToGo: 1, yardsToGoal: 55 },
      { yardsToGo: 4, yardsToGoal: 42 },
      { yardsToGo: 2, yardsToGoal: 60 },
    ];
    const goes = (aggression: number) =>
      situations.filter(
        (s) =>
          fourthDownDecision({
            ...s,
            scoreDiff: 0,
            quarter: 2,
            clockSeconds: 600,
            isOvertime: false,
            aggression,
          }) === "go",
      ).length;

    expect(goes(90)).toBeGreaterThan(goes(20));
  });
});

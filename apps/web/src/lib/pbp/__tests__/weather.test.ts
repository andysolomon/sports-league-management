import { describe, it, expect } from "vitest";
import { simulateGameLog } from "../engine";
import {
  homeFieldEdge,
  isRivalry,
  rivalryPairKey,
  NEUTRAL_PRESTIGE,
} from "../crowd";
import {
  CLEAR_WEATHER,
  deriveWeather,
  isFairWeather,
  NEUTRAL_MODIFIERS,
  weatherModifiers,
  type Weather,
} from "../weather";
import type {
  PbpGameInput,
  PlayerSimProfile,
  TeamSimProfile,
} from "../types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 2], ["RB", 3], ["WR", 5], ["TE", 2], ["DE", 2], ["DT", 2],
    ["OLB", 2], ["MLB", 2], ["CB", 3], ["S", 2], ["K", 1], ["P", 1],
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

const buildTeam = (teamId: string, strength: number): TeamSimProfile => ({
  teamId,
  strength,
  players: buildRoster(teamId, strength),
});

function gameInput(overrides: Partial<PbpGameInput> = {}): PbpGameInput {
  return {
    home: buildTeam("home", 70),
    away: buildTeam("away", 70),
    seed: 4242,
    flavor: "balanced",
    ...overrides,
  };
}

const BLIZZARD: Weather = {
  temperatureF: 24,
  windMph: 26,
  precipitation: "heavy",
  condition: "Heavy snow",
};

describe("deriveWeather", () => {
  it("is deterministic — same season, week and venue, same weather", () => {
    const input = { seasonId: "season_a", week: 6, venueId: "team_b" };
    const first = deriveWeather(input);
    for (let i = 0; i < 20; i++) {
      expect(deriveWeather(input)).toEqual(first);
    }
  });

  it("varies by week and by venue", () => {
    const base = { seasonId: "season_a", week: 6, venueId: "team_b" };
    expect(deriveWeather({ ...base, week: 7 })).not.toEqual(deriveWeather(base));
    expect(deriveWeather({ ...base, venueId: "team_c" })).not.toEqual(
      deriveWeather(base),
    );
  });

  it("skews colder and windier late in the season", () => {
    // 500 venues per week, so this is a distribution claim rather than a lucky
    // pair of samples.
    const sample = (week: number) => {
      let temp = 0;
      let wind = 0;
      for (let i = 0; i < 500; i++) {
        const w = deriveWeather({
          seasonId: "season_a",
          week,
          venueId: `venue_${i}`,
        });
        temp += w.temperatureF;
        wind += w.windMph;
      }
      return { temp: temp / 500, wind: wind / 500 };
    };
    const early = sample(2);
    const late = sample(13);
    expect(late.temp).toBeLessThan(early.temp - 20);
    expect(late.wind).toBeGreaterThan(early.wind);
  });

  it("rains more often late than early", () => {
    const wetCount = (week: number) => {
      let wet = 0;
      for (let i = 0; i < 500; i++) {
        const w = deriveWeather({
          seasonId: "season_a",
          week,
          venueId: `venue_${i}`,
        });
        if (w.precipitation !== "none") wet += 1;
      }
      return wet;
    };
    expect(wetCount(13)).toBeGreaterThan(wetCount(2));
  });

  it("never calls freezing precipitation rain, or warm precipitation snow", () => {
    for (let week = 1; week <= 14; week++) {
      for (let i = 0; i < 60; i++) {
        const w = deriveWeather({
          seasonId: "s",
          week,
          venueId: `venue_${i}`,
        });
        if (w.precipitation === "none") continue;
        if (w.temperatureF <= 32) expect(w.condition).toMatch(/snow/i);
        else expect(w.condition).toMatch(/rain/i);
      }
    }
  });

  it("keeps a venue's climate stable across the season", () => {
    /*
     * A warm-climate program should stay relatively warm all year. Without a
     * per-venue offset the model would randomly make the same stadium the
     * coldest in week 3 and the warmest in week 12, which reads as noise rather
     * than as geography.
     */
    const weeks = [2, 5, 8, 11];
    const ranks = weeks.map((week) => {
      const temps = Array.from({ length: 12 }, (_, i) => ({
        venue: `venue_${i}`,
        t: deriveWeather({ seasonId: "s", week, venueId: `venue_${i}` })
          .temperatureF,
      }));
      temps.sort((a, b) => b.t - a.t);
      return temps.map((x) => x.venue);
    });
    // The warmest venue in one week should be in the warm half in the others.
    const warmest = ranks[0][0];
    for (const order of ranks.slice(1)) {
      expect(order.indexOf(warmest)).toBeLessThan(9);
    }
  });
});

describe("weatherModifiers", () => {
  it("is exactly the identity in clear weather", () => {
    // Exactly 1 matters: the engine multiplies unconditionally, and only an
    // exact 1 keeps the gate-off path bit-identical to v1.
    expect(weatherModifiers(CLEAR_WEATHER)).toEqual(NEUTRAL_MODIFIERS);
    expect(isFairWeather(CLEAR_WEATHER)).toBe(true);
  });

  it("makes throwing, kicking and holding onto the ball all harder in a blizzard", () => {
    const m = weatherModifiers(BLIZZARD);
    expect(m.passAccuracy).toBeLessThan(1);
    expect(m.kickDistance).toBeLessThan(1);
    expect(m.explosiveRate).toBeLessThan(1);
    expect(m.fumbleRate).toBeGreaterThan(1);
  });

  it("compounds stressors rather than taking the worst one", () => {
    const windy: Weather = { ...CLEAR_WEATHER, windMph: 26, condition: "Windy" };
    const wet: Weather = {
      ...CLEAR_WEATHER,
      precipitation: "heavy",
      condition: "Heavy rain",
    };
    const both: Weather = { ...windy, precipitation: "heavy" };
    const m = (w: Weather) => weatherModifiers(w).passAccuracy;
    expect(m(both)).toBeLessThan(Math.min(m(windy), m(wet)));
  });

  it("stays inside bounds no matter how extreme the input", () => {
    const absurd: Weather = {
      temperatureF: -80,
      windMph: 200,
      precipitation: "heavy",
      condition: "Apocalypse",
    };
    const m = weatherModifiers(absurd);
    expect(m.passAccuracy).toBeGreaterThanOrEqual(0.6);
    expect(m.kickDistance).toBeGreaterThanOrEqual(0.7);
    expect(m.fumbleRate).toBeLessThanOrEqual(2.5);
    expect(m.explosiveRate).toBeGreaterThanOrEqual(0.55);
  });

  it("leaves kicking alone in the cold but punishes it in the wind", () => {
    const cold: Weather = { ...CLEAR_WEATHER, temperatureF: 10 };
    const windy: Weather = { ...CLEAR_WEATHER, windMph: 28 };
    expect(weatherModifiers(cold).kickDistance).toBe(1);
    expect(weatherModifiers(windy).kickDistance).toBeLessThan(0.85);
  });
});

describe("homeFieldEdge", () => {
  it("returns the base edge exactly with neutral prestige and no rivalry", () => {
    // The contract that makes this slice safe to enable: a league that has
    // configured nothing behaves exactly as it did before.
    for (const base of [2.5, 0.75, 1.2]) {
      expect(homeFieldEdge({ base })).toBe(base);
      expect(
        homeFieldEdge({
          base,
          venuePrestige: NEUTRAL_PRESTIGE,
          rivalryIntensity: 0,
        }),
      ).toBe(base);
    }
  });

  it("amplifies with venue prestige and shrinks without it", () => {
    expect(homeFieldEdge({ base: 1, venuePrestige: 95 })).toBeGreaterThan(1);
    expect(homeFieldEdge({ base: 1, venuePrestige: 10 })).toBeLessThan(1);
  });

  it("damps home field in a rivalry", () => {
    // The interesting behavior: a rivalry is the one night nobody is
    // intimidated, so it is NOT just "more home field".
    expect(homeFieldEdge({ base: 1, rivalryIntensity: 100 })).toBeLessThan(
      homeFieldEdge({ base: 1, rivalryIntensity: 0 }),
    );
  });

  it("clamps out-of-range inputs rather than producing nonsense", () => {
    expect(homeFieldEdge({ base: 1, rivalryIntensity: 400 })).toBe(
      homeFieldEdge({ base: 1, rivalryIntensity: 100 }),
    );
    expect(homeFieldEdge({ base: 1, venuePrestige: -50 })).toBe(
      homeFieldEdge({ base: 1, venuePrestige: 0 }),
    );
  });

  it("treats a pairing as one rivalry whichever way round it is named", () => {
    expect(rivalryPairKey("team_b", "team_a")).toBe(
      rivalryPairKey("team_a", "team_b"),
    );
    expect(isRivalry(0)).toBe(false);
    expect(isRivalry(undefined)).toBe(false);
    expect(isRivalry(40)).toBe(true);
  });
});

describe("weather gate in the engine", () => {
  it("ignores conditions entirely while the gate is off", () => {
    // Passing weather without enabling it must change nothing — that is what
    // lets a caller derive conditions for display without simulating in them.
    const withWeather = simulateGameLog(gameInput({ weather: BLIZZARD }));
    const without = simulateGameLog(gameInput());
    expect(withWeather).toEqual(without);
    expect(withWeather.weather).toBeUndefined();
  });

  it("records the conditions it actually played in", () => {
    const log = simulateGameLog(
      gameInput({ weather: BLIZZARD, features: { weather: true } }),
    );
    expect(log.weather).toEqual(BLIZZARD);
  });

  it("does not record weather it was not given, even with the gate on", () => {
    // Absence must mean "not modelled". Substituting a default would be a
    // fabricated fact about a real game.
    const log = simulateGameLog(gameInput({ features: { weather: true } }));
    expect(log.weather).toBeUndefined();
  });

  it("reproduces the ungated log when the conditions are clear", () => {
    const clear = simulateGameLog(
      gameInput({ weather: CLEAR_WEATHER, features: { weather: true } }),
    );
    const v1 = simulateGameLog(gameInput());
    expect(clear.drives).toEqual(v1.drives);
    expect(clear.homeScore).toBe(v1.homeScore);
  });

  it("lowers completion percentage and raises fumbles in bad weather", () => {
    const measure = (weather: Weather | undefined) => {
      let complete = 0;
      let attempts = 0;
      let fumbles = 0;
      for (let i = 0; i < 120; i++) {
        const log = simulateGameLog(
          gameInput({
            seed: 31000 + i,
            weather,
            features: weather ? { weather: true } : undefined,
          }),
        );
        for (const drive of log.drives) {
          for (const play of drive.plays) {
            if (play.playType === "pass_complete") {
              complete += 1;
              attempts += 1;
            } else if (play.playType === "pass_incomplete") {
              attempts += 1;
            }
            if (play.participants.some((p) => p.role === "fumbler")) {
              fumbles += 1;
            }
          }
        }
      }
      return { pct: complete / attempts, fumbles };
    };

    const fair = measure(CLEAR_WEATHER);
    const foul = measure(BLIZZARD);
    expect(foul.pct).toBeLessThan(fair.pct);
    expect(foul.fumbles).toBeGreaterThan(fair.fumbles);
  });

  it("blends crowd inputs into the home edge only under the gate", () => {
    const rivalryOn = simulateGameLog(
      gameInput({ rivalryIntensity: 100, features: { weather: true } }),
    );
    const rivalryIgnored = simulateGameLog(
      gameInput({ rivalryIntensity: 100 }),
    );
    const plain = simulateGameLog(gameInput());
    expect(rivalryIgnored).toEqual(plain);
    expect(rivalryOn).not.toEqual(plain);
  });
});

import { describe, it, expect } from "vitest";
import {
  emptySimContext,
  fixtureSimConditions,
  resolveSimFeatures,
  type SeasonSimContext,
} from "@/lib/sim-context";
import {
  DYNASTY_CONFIG_DEFAULTS,
  type DynastyConfig,
} from "@/lib/dynasty-config";
import { rivalryPairKey } from "@/lib/rivalries";
import { deriveWeather } from "@/lib/pbp/weather";

const config = (patch: Partial<DynastyConfig> = {}): DynastyConfig => ({
  ...DYNASTY_CONFIG_DEFAULTS,
  ...patch,
});

describe("resolveSimFeatures", () => {
  it("turns every Epic A mechanic on for a default league", () => {
    // The activation contract: flag on plus untouched settings means the full
    // game. A league that has configured nothing gets everything.
    expect(resolveSimFeatures(true, config())).toEqual({
      scoringV2: true,
      penalties: true,
      situational: true,
      balance: true,
      weather: true,
    });
  });

  it("returns no gates at all when the flag is off, whatever the league wants", () => {
    /*
     * The flag is the OUTER gate, not one vote among several. This is what
     * makes it a usable kill switch: one env var backs the epic out for
     * everyone without editing a single league's settings.
     */
    expect(resolveSimFeatures(false, config())).toEqual({});
    expect(
      resolveSimFeatures(false, config({ penaltiesEnabled: true })),
    ).toEqual({});
  });

  it("drops only the mechanics a league opted out of", () => {
    const features = resolveSimFeatures(
      true,
      config({ penaltiesEnabled: false, weatherEnabled: false }),
    );
    expect(features).toEqual({
      scoringV2: true,
      situational: true,
      balance: true,
    });
  });

  it("omits disabled gates rather than setting them false", () => {
    /*
     * `{ penalties: false }` and `{}` mean the same thing to the engine, but
     * only the second is honest on a stored log: recording `false` would claim
     * the engine considered penalties and declined, which is indistinguishable
     * from a build that never had them.
     */
    const features = resolveSimFeatures(true, config({ penaltiesEnabled: false }));
    expect("penalties" in features).toBe(false);
  });

  it("ignores knobs that belong to other epics", () => {
    // Injuries (A4) and polls (D3) have no engine gate yet. Reading them here
    // would silently enable something that does not exist.
    const features = resolveSimFeatures(
      true,
      config({ injuriesEnabled: true, pollsEnabled: true }),
    );
    expect(Object.keys(features).sort()).toEqual([
      "balance",
      "penalties",
      "scoringV2",
      "situational",
      "weather",
    ]);
  });
});

describe("fixtureSimConditions", () => {
  const fixture = {
    seasonId: "season_1",
    week: 6,
    homeTeamId: "team_home",
    awayTeamId: "team_away",
  };

  const context = (over: Partial<SeasonSimContext> = {}): SeasonSimContext => ({
    ...emptySimContext("league_1"),
    ...over,
  });

  it("derives no weather while the gate is off", () => {
    // Computing it anyway would be harmless to the engine but misleading: the
    // log records what it was given, and a value the game did not simulate
    // under has no business being computed here.
    expect(fixtureSimConditions(context(), fixture).weather).toBeUndefined();
  });

  it("derives the same weather the schedule's forecast shows", () => {
    /*
     * The schedule chip and the simulator must agree, or a fixture would be
     * previewed in one climate and played in another. They agree because both
     * derive from (season, week, home team) — this asserts the simulator side
     * picks the same inputs.
     */
    const conditions = fixtureSimConditions(
      context({ features: { weather: true } }),
      fixture,
    );
    expect(conditions.weather).toEqual(
      deriveWeather({ seasonId: "season_1", week: 6, venueId: "team_home" }),
    );
  });

  it("derives no weather for a fixture with no week", () => {
    // Week is what places a game in the season's calendar. Guessing one would
    // invent a climate for a game that has no place in the year.
    const conditions = fixtureSimConditions(
      context({ features: { weather: true } }),
      { ...fixture, week: null },
    );
    expect(conditions.weather).toBeUndefined();
  });

  it("finds a rivalry declared in either direction", () => {
    const rivalries = new Map([
      [rivalryPairKey("team_away", "team_home"), 80],
    ]);
    expect(
      fixtureSimConditions(context({ rivalries }), fixture).rivalryIntensity,
    ).toBe(80);
  });

  it("leaves rivalry intensity absent for an ordinary matchup", () => {
    // Absent, not zero — the engine treats absence as neutral, and zero would
    // be a declared rivalry that nobody cares about.
    const conditions = fixtureSimConditions(context(), fixture);
    expect("rivalryIntensity" in conditions).toBe(false);
  });

  it("supplies rivalry intensity regardless of the weather gate", () => {
    // Rivalry feeds home-field advantage, which the engine reads under the
    // weather gate. The context still reports it; the engine decides.
    const rivalries = new Map([[rivalryPairKey("team_home", "team_away"), 55]]);
    expect(
      fixtureSimConditions(context({ rivalries }), fixture).rivalryIntensity,
    ).toBe(55);
  });
});

describe("emptySimContext", () => {
  it("models nothing", () => {
    const context = emptySimContext("league_1");
    expect(context.features).toEqual({});
    expect(context.rivalries.size).toBe(0);
  });
});

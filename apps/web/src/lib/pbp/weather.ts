import { mulberry32, seedFor } from "@/lib/rng";

/*
 * Game conditions (Dynasty Mode A5).
 *
 * Pure and deterministic. Weather for a fixture is a FUNCTION of the season,
 * the week and the venue — never of wall-clock time, never of an external
 * forecast API, and never of the game's own PRNG.
 *
 * ## Why it uses its own seed stream
 *
 * `deriveWeather` draws from `seedFor("weather", ...)`, which is a different
 * stream from the engine's `seedFor("pbp", fixtureId)`. That separation is
 * load-bearing in two directions:
 *
 * - Deriving weather costs the game engine ZERO random draws, so the golden-log
 *   parity fixture is unaffected whether or not a caller computed conditions.
 * - Weather cannot correlate with what happens in the game. If both came off
 *   the same stream, a cold week would systematically also be a fumble-heavy
 *   week for reasons having nothing to do with the cold.
 *
 * ## Why it is derived and not stored
 *
 * A schedule shows conditions for games that have not been played. Storing a
 * row per fixture would mean writing rows for a schedule that can still be
 * regenerated. Deriving means the forecast is stable, free, and available
 * before a game exists — and once a game IS played under the `weather` gate,
 * the conditions it actually played in are recorded on its log, which is the
 * copy history reads.
 */

export type Precipitation = "none" | "light" | "heavy";

export interface Weather {
  /** Fahrenheit. */
  temperatureF: number;
  /** Sustained wind, mph. */
  windMph: number;
  precipitation: Precipitation;
  /** Short label for UI: "Clear", "Windy", "Rain", "Snow", … */
  condition: string;
}

/**
 * Neutral conditions: a mild, still, clear day.
 *
 * `weatherModifiers(CLEAR_WEATHER)` is the identity, which is what lets the
 * gate be a no-op rather than a subtle re-tune.
 */
export const CLEAR_WEATHER: Readonly<Weather> = Object.freeze({
  temperatureF: 68,
  windMph: 4,
  precipitation: "none",
  condition: "Clear",
});

/**
 * A high-school season runs roughly August to December, so week number is a
 * decent proxy for the calendar. Week 1 is late summer; by week 14 it is
 * playoff weather.
 */
const SEASON_WEEKS = 14;

function seasonProgress(week: number): number {
  if (!Number.isFinite(week)) return 0;
  const clamped = Math.max(1, Math.min(SEASON_WEEKS, Math.round(week)));
  return (clamped - 1) / (SEASON_WEEKS - 1);
}

export interface DeriveWeatherInput {
  /** Stable id for the season — its Convex id in production. */
  seasonId: string;
  week: number;
  /**
   * Stable id for the place the game is played. The home team's id is the
   * natural choice: a program plays its home games in one climate.
   */
  venueId: string;
}

/**
 * Conditions for one fixture.
 *
 * Same inputs always produce the same weather, so a schedule page, a Gamecast
 * and a re-simulation all agree without anyone storing anything.
 */
export function deriveWeather(input: DeriveWeatherInput): Weather {
  const rand = mulberry32(
    seedFor("weather", input.seasonId, String(input.week), input.venueId),
  );
  const progress = seasonProgress(input.week);

  /*
   * Temperature falls through the season. The venue draw is applied as a fixed
   * offset per venue so a warm-climate program stays warm all year rather than
   * being randomly cold in week 3 and hot in week 12.
   */
  const venueOffset = (rand() - 0.5) * 24;
  const seasonal = 82 - progress * 42;
  const daily = (rand() - 0.5) * 18;
  const temperatureF = Math.round(seasonal + venueOffset + daily);

  // Wind picks up as the season goes on, with a long tail for the rare gale.
  const windRoll = rand();
  const windMph = Math.round(
    3 + progress * 6 + windRoll * windRoll * (14 + progress * 12),
  );

  /*
   * Precipitation chance also rises late. Whether it falls as snow is decided
   * by the temperature, not by another draw — sleet at 70 degrees would be a
   * tell that the model is a lookup table rather than a climate.
   */
  const precipRoll = rand();
  const precipChance = 0.14 + progress * 0.2;
  let precipitation: Precipitation = "none";
  if (precipRoll < precipChance * 0.35) precipitation = "heavy";
  else if (precipRoll < precipChance) precipitation = "light";

  return {
    temperatureF,
    windMph,
    precipitation,
    condition: describeConditions(temperatureF, windMph, precipitation),
  };
}

function describeConditions(
  temperatureF: number,
  windMph: number,
  precipitation: Precipitation,
): string {
  const freezing = temperatureF <= 32;
  if (precipitation === "heavy") return freezing ? "Heavy snow" : "Heavy rain";
  if (precipitation === "light") return freezing ? "Snow" : "Rain";
  if (windMph >= 18) return freezing ? "Bitter wind" : "Windy";
  if (freezing) return "Freezing";
  if (temperatureF >= 88) return "Hot";
  return "Clear";
}

/**
 * How conditions change play.
 *
 * Multipliers, all 1 in clear weather. Returning multipliers rather than
 * absolute rates means this module never has to know the engine's baseline
 * numbers, and the engine never has to know what a "heavy rain" is.
 */
export interface WeatherModifiers {
  /** Scales completion probability. */
  passAccuracy: number;
  /** Scales field-goal and punt distance. */
  kickDistance: number;
  /** Scales fumble probability. */
  fumbleRate: number;
  /** Scales the chance of an explosive play. */
  explosiveRate: number;
}

export const NEUTRAL_MODIFIERS: Readonly<WeatherModifiers> = Object.freeze({
  passAccuracy: 1,
  kickDistance: 1,
  fumbleRate: 1,
  explosiveRate: 1,
});

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function weatherModifiers(weather: Weather): WeatherModifiers {
  /*
   * Three independent stressors — wind, wet, cold — that compound. A freezing
   * night with heavy snow and a 25 mph wind should be genuinely miserable to
   * throw in, which only happens if the factors multiply rather than the model
   * picking whichever is worst.
   */
  const wind = clamp((weather.windMph - 8) / 22, 0, 1);
  const wet =
    weather.precipitation === "heavy"
      ? 1
      : weather.precipitation === "light"
        ? 0.5
        : 0;
  // Cold hands, hard ball. Below about 40F it starts to matter.
  const cold = clamp((40 - weather.temperatureF) / 40, 0, 1);

  return {
    passAccuracy: clamp(1 - wind * 0.16 - wet * 0.12 - cold * 0.08, 0.6, 1),
    // Wind dominates kicking, and it is the one place cold barely matters.
    kickDistance: clamp(1 - wind * 0.2 - wet * 0.05, 0.7, 1),
    fumbleRate: clamp(1 + wet * 0.7 + cold * 0.5, 1, 2.5),
    explosiveRate: clamp(1 - wind * 0.15 - wet * 0.2 - cold * 0.1, 0.55, 1),
  };
}

/** True when conditions are neutral enough to leave play untouched. */
export function isFairWeather(weather: Weather): boolean {
  const m = weatherModifiers(weather);
  return (
    m.passAccuracy === 1 &&
    m.kickDistance === 1 &&
    m.fumbleRate === 1 &&
    m.explosiveRate === 1
  );
}

import type { PbpGameLog, PbpPlay } from "./types";

/*
 * Stored play-log compatibility (Dynasty Mode A1).
 *
 * `gamePlayLogs` rows are IMMUTABLE. A game that was simulated under engine
 * 1.0.0 keeps its 1.0.0 log forever — we never rewrite history to match a newer
 * engine, because the log is the evidence for the box score and stat lines that
 * were derived from it at the time. Re-deriving them under a different engine
 * would silently change a player's recorded season.
 *
 * So compatibility happens on READ. Every consumer (Gamecast, box score, and
 * later the record book) calls `normalizeGameLog` and gets a shape it can rely
 * on, whatever version produced it.
 *
 * ## What normalizing does NOT do
 *
 * It does not invent data. A v1 log has no penalties and no return yardage
 * because the v1 engine did not model them — not because they were zero. Those
 * fields stay `undefined`, and a reader must render "—" rather than "0".
 * Defaulting them to zero would turn "unknown" into a factual claim, and Epic
 * D's record book would later treat that claim as history.
 */

/** Versions this module knows how to read. */
export type KnownEngineVersion = "1.0.0" | "2.0.0";

export interface NormalizedGameLog extends PbpGameLog {
  /** Resolved version, defaulted to 1.0.0 when a row predates the field. */
  engineVersion: string;
  /** True when the log came from an engine older than the current one. */
  upconverted: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerce a stored log into the current shape.
 *
 * Tolerant by design: a malformed or partial blob yields an empty-but-valid log
 * rather than throwing. A corrupt row should degrade one game's Gamecast, not
 * take down the page that lists it.
 */
export function normalizeGameLog(
  raw: unknown,
  engineVersion?: string,
): NormalizedGameLog {
  const version = engineVersion ?? "1.0.0";

  if (!isRecord(raw)) {
    return {
      seed: 0,
      decisive: false,
      homeTeamId: "",
      awayTeamId: "",
      homeScore: 0,
      awayScore: 0,
      drives: [],
      engineVersion: version,
      upconverted: version !== "2.0.0",
    };
  }

  const drives = Array.isArray(raw.drives) ? raw.drives : [];

  return {
    seed: typeof raw.seed === "number" ? raw.seed : 0,
    decisive: raw.decisive === true,
    homeTeamId: typeof raw.homeTeamId === "string" ? raw.homeTeamId : "",
    awayTeamId: typeof raw.awayTeamId === "string" ? raw.awayTeamId : "",
    homeScore: typeof raw.homeScore === "number" ? raw.homeScore : 0,
    awayScore: typeof raw.awayScore === "number" ? raw.awayScore : 0,
    // Drives and plays pass through untouched. The v2 additions are all
    // optional, so a v1 play already satisfies the current `PbpPlay` type —
    // there is nothing to fill in, and filling anything in would be a lie.
    drives: drives as PbpGameLog["drives"],
    version: raw.version === 2 ? 2 : undefined,
    engineVersion: version,
    upconverted: version !== "2.0.0",
  };
}

/**
 * Did this engine model the given mechanic?
 *
 * The honest question a UI should ask before rendering a stat. Penalties on a
 * v1 log are unknown, not zero, and a box score should show "—" rather than
 * claiming a clean game.
 */
export function logModels(
  log: Pick<NormalizedGameLog, "engineVersion">,
  mechanic: "returns" | "safeties" | "twoPointConversions" | "penalties",
): boolean {
  if (log.engineVersion === "1.0.0") return false;
  // Penalties arrive in A2; everything else in this list ships with A1.
  if (mechanic === "penalties") return false;
  return true;
}

/** Flatten a normalized log's plays, in order. */
export function normalizedPlays(log: NormalizedGameLog): PbpPlay[] {
  return log.drives.flatMap((drive) => drive.plays);
}

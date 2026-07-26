/*
 * Dynasty Mode per-league settings (F5) — shared shape and defaults.
 *
 * This module is the CANONICAL definition and lives under `convex/` because the
 * Convex bundler can only reach files in that directory, while `src/` can reach
 * both — the same direction `convex/lib/standings.ts` and `convex/lib/hsSprt.ts`
 * are already imported from Next code.
 *
 * `src/lib/dynasty-config.ts` re-exports this module rather than mirroring it,
 * so the Convex runtime and the Next layer CANNOT drift: one object, one
 * resolver, one set of defaults, no copy to keep in sync.
 *
 * ## Why a table and not a feature flag
 *
 * Flags are per-deploy and per-environment. "This league finds injuries too
 * punishing" is per-league and needs to change at runtime, mid-season, without
 * shipping. The roadmap spends only four flags total (one per epic) and gates
 * individual mechanics here.
 *
 * ## Absence is legal
 *
 * A league with no `dynastyConfig` row is fully configured — it uses every
 * default below. That is what keeps the table migration-free: a new knob needs
 * no backfill, because `resolveDynastyConfig` fills it in.
 */

export type TransferVolume = "low" | "normal" | "high";

export interface DynastyConfig {
  /** Penalties are rolled during simulation (Epic A2). */
  penaltiesEnabled: boolean;
  /** Injuries can occur during simulation (Epic A4). */
  injuriesEnabled: boolean;
  /** Weather affects play outcomes (Epic A5). */
  weatherEnabled: boolean;
  /** 0 = none, 1 = normal, 2 = brutal. Scales injury severity. */
  injurySeverityScale: number;
  /** Players may transfer in and out during the offseason (Epic B4). */
  transfersEnabled: boolean;
  /** How much roster churn an offseason produces. */
  transferVolume: TransferVolume;
  /** Scouting budget per offseason (Epic B3). */
  scoutingPointsPerOffseason: number;
  /** Training budget per offseason (Epic B6). */
  trainingPointsPerOffseason: number;
  /** Roster size the freshman generator tops teams back up to. */
  targetRosterSize: number;
  /** Coaches can be fired for missing goals (Epic C2). */
  jobSecurityEnabled: boolean;
  /** Weekly power rankings are computed (Epic D3). */
  pollsEnabled: boolean;
}

/**
 * Defaults describe a league that plays the full game. Mechanics default ON so
 * that enabling an epic's feature flag is enough to see it; a commissioner opts
 * OUT of anything their league dislikes.
 *
 * `targetRosterSize` matches `DEFAULT_TARGET_ROSTER_SIZE` in
 * `convex/lib/offseason.ts` — the generator and this knob must agree.
 */
export const DYNASTY_CONFIG_DEFAULTS: Readonly<DynastyConfig> = Object.freeze({
  penaltiesEnabled: true,
  injuriesEnabled: true,
  weatherEnabled: true,
  injurySeverityScale: 1,
  transfersEnabled: true,
  transferVolume: "normal",
  scoutingPointsPerOffseason: 100,
  trainingPointsPerOffseason: 100,
  targetRosterSize: 48,
  jobSecurityEnabled: true,
  pollsEnabled: true,
});

/** Bounds. Values outside these are clamped rather than rejected. */
export const DYNASTY_CONFIG_BOUNDS = Object.freeze({
  injurySeverityScale: { min: 0, max: 2 },
  scoutingPointsPerOffseason: { min: 0, max: 500 },
  trainingPointsPerOffseason: { min: 0, max: 500 },
  targetRosterSize: { min: 1, max: 60 },
});

const TRANSFER_VOLUMES: readonly TransferVolume[] = ["low", "normal", "high"];

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** A stored row: every knob optional, plus bookkeeping we do not surface. */
export type DynastyConfigDoc = Partial<
  Record<keyof DynastyConfig, number | boolean | string | undefined>
>;

/**
 * Resolve a stored row (or its absence) into a fully-populated config.
 *
 * Total by construction: `null`, `{}`, a partial row and a row with an
 * out-of-range or misspelled value all produce a valid config. Settings should
 * never be able to break a simulation — a bad value falls back to the default
 * rather than propagating `undefined` into the engine.
 */
export function resolveDynastyConfig(
  doc: DynastyConfigDoc | null | undefined,
): DynastyConfig {
  if (!doc) return { ...DYNASTY_CONFIG_DEFAULTS };

  const bool = (key: keyof DynastyConfig): boolean => {
    const value = doc[key];
    return typeof value === "boolean"
      ? value
      : (DYNASTY_CONFIG_DEFAULTS[key] as boolean);
  };

  const num = (
    key: keyof typeof DYNASTY_CONFIG_BOUNDS & keyof DynastyConfig,
  ): number => {
    const value = doc[key];
    const bounds = DYNASTY_CONFIG_BOUNDS[key];
    return typeof value === "number"
      ? clamp(value, bounds.min, bounds.max)
      : (DYNASTY_CONFIG_DEFAULTS[key] as number);
  };

  const volume =
    typeof doc.transferVolume === "string" &&
    (TRANSFER_VOLUMES as readonly string[]).includes(doc.transferVolume)
      ? (doc.transferVolume as TransferVolume)
      : DYNASTY_CONFIG_DEFAULTS.transferVolume;

  return {
    penaltiesEnabled: bool("penaltiesEnabled"),
    injuriesEnabled: bool("injuriesEnabled"),
    weatherEnabled: bool("weatherEnabled"),
    injurySeverityScale: num("injurySeverityScale"),
    transfersEnabled: bool("transfersEnabled"),
    transferVolume: volume,
    scoutingPointsPerOffseason: num("scoutingPointsPerOffseason"),
    trainingPointsPerOffseason: num("trainingPointsPerOffseason"),
    targetRosterSize: num("targetRosterSize"),
    jobSecurityEnabled: bool("jobSecurityEnabled"),
    pollsEnabled: bool("pollsEnabled"),
  };
}

/** Normalize an inbound patch: drop unknown keys, clamp what is in range. */
export function normalizeDynastyConfigPatch(
  patch: Partial<DynastyConfig>,
): Partial<DynastyConfig> {
  const resolved = resolveDynastyConfig(patch as DynastyConfigDoc);
  const out: Partial<DynastyConfig> = {};
  for (const key of Object.keys(patch) as Array<keyof DynastyConfig>) {
    if (key in DYNASTY_CONFIG_DEFAULTS) {
      // @ts-expect-error index write across a heterogeneous record
      out[key] = resolved[key];
    }
  }
  return out;
}

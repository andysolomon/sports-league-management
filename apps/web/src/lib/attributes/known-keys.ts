/**
 * Canonical attribute codes accepted for manual rating edits (WSM ratings-edit).
 * Unions Madden-style codes (synthetic roster / ingest) with SPRT component keys.
 */
import { GROUP_KEYS, COMMON_KEYS } from "@/lib/synthetic-attributes";

/** SPRT model component keys (lib/ratings/sprt.ts) plus display OVR. */
const SPRT_COMPONENT_KEYS = [
  "efficiency",
  "production",
  "scoring",
  "mobility",
  "rushEff",
  "volume",
  "receiving",
  "explosiveness",
  "hands",
  "passRush",
  "pressure",
  "runStop",
  "tackling",
  "coverage",
  "ballHawk",
  "OVR",
] as const;

const MADDEN_KEYS = new Set<string>([
  ...COMMON_KEYS,
  ...Object.values(GROUP_KEYS).flat(),
]);

const KNOWN_KEYS = new Set<string>([
  ...SPRT_COMPONENT_KEYS,
  ...MADDEN_KEYS,
  // Admin / PFF canonical examples used in uploads and tests.
  "armStrength",
  "accuracy",
  "decisionMaking",
  "overall",
]);

export function isKnownAttributeKey(key: string): boolean {
  return KNOWN_KEYS.has(key);
}

const OVERALL_KEYS = ["overall", "OVR", "OVERALL", "Overall"] as const;

/** Recompute OVR from component attributes when not explicitly provided. */
export function computeRatingOverall(
  attributes: Record<string, number>,
): number {
  for (const key of OVERALL_KEYS) {
    const v = attributes[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      return Math.round(Math.max(0, Math.min(99, v)));
    }
  }
  const componentKeys = Object.keys(attributes).filter(
    (k) => !OVERALL_KEYS.includes(k as (typeof OVERALL_KEYS)[number]),
  );
  if (componentKeys.length === 0) return 0;
  const sum = componentKeys.reduce((a, k) => a + attributes[k], 0);
  return Math.round(Math.max(0, Math.min(99, sum / componentKeys.length)));
}

export function validatePlayerAttributeEdit(
  attributes: Record<string, number>,
):
  | { ok: true; normalized: Record<string, number>; weightedOverall: number }
  | { ok: false; error: string } {
  const entries = Object.entries(attributes);
  if (entries.length === 0) {
    return { ok: false, error: "empty_attributes" };
  }

  const normalized: Record<string, number> = {};
  for (const [key, value] of entries) {
    if (!isKnownAttributeKey(key)) {
      return { ok: false, error: `invalid_attribute_key:${key}` };
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, error: `invalid_attribute_value:${key}` };
    }
    const rounded = Math.round(value);
    if (rounded < 0 || rounded > 99) {
      return { ok: false, error: `attribute_out_of_range:${key}` };
    }
    normalized[key] = rounded;
  }

  const withoutStoredOvr = { ...normalized };
  for (const k of OVERALL_KEYS) delete withoutStoredOvr[k];

  const weightedOverall = computeRatingOverall(normalized);
  const withOvr = { ...withoutStoredOvr, OVR: weightedOverall };

  return { ok: true, normalized: withOvr, weightedOverall };
}

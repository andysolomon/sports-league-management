/**
 * Madden source adapter.
 *
 * Assumed payload shape (one row, mirrors EA's roster export):
 *
 *   {
 *     "id": "m_123",
 *     "POS": "QB",
 *     "OVR": 92,
 *     "SPD": 88,
 *     "STR": 75,
 *     "AWR": 91,
 *     "...": ...
 *   }
 *
 * The shape is flat — every uppercase numeric field is treated as an
 * attribute. `POS` is the position-group code (must map to our
 * canonical taxonomy). Returns null when invalid.
 */
import { isValidPositionGroup } from "../position-groups";
import type { NormalizedSource } from "./types";

const NON_ATTRIBUTE_KEYS = new Set([
  "id",
  "POS",
  "playerId",
  "name",
  "team",
  "TEAM",
]);

export function normalizeMadden(
  payload: unknown,
): NormalizedSource | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;

  if (!isValidPositionGroup(row.POS)) return null;

  const attributes: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) {
    if (NON_ATTRIBUTE_KEYS.has(key)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    attributes[key] = value;
  }
  if (Object.keys(attributes).length === 0) return null;

  return { positionGroup: row.POS, attributes };
}

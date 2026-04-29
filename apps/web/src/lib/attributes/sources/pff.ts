/**
 * PFF source adapter.
 *
 * Assumed payload shape (one row, what an admin uploads + what the
 * future paid-feed integration will normalize to):
 *
 *   {
 *     "playerId": "p_123",
 *     "positionGroup": "QB",
 *     "attributes": {
 *       "armStrength": 92,
 *       "accuracy": 88,
 *       "decisionMaking": 85
 *     }
 *   }
 *
 * Returns null when the shape doesn't match — caller treats null as
 * "this row was not a valid PFF row" (skip + log; no throw).
 */
import { isValidPositionGroup } from "../position-groups";
import type { NormalizedSource } from "./types";

export function normalizePff(payload: unknown): NormalizedSource | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;

  if (!isValidPositionGroup(row.positionGroup)) return null;

  const raw = row.attributes;
  if (!raw || typeof raw !== "object") return null;

  const attributes: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    attributes[key] = value;
  }
  if (Object.keys(attributes).length === 0) return null;

  return { positionGroup: row.positionGroup, attributes };
}

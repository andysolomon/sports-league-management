/**
 * Admin-uploaded JSON source adapter.
 *
 * The "canonical" shape — same as the PFF format but explicitly
 * labelled as the admin's own data. Used when the admin pastes JSON
 * directly via the upload modal (WSM-000063) rather than uploading
 * a vendor format.
 *
 *   {
 *     "playerId": "p_123",
 *     "positionGroup": "QB",
 *     "attributes": {
 *       "armStrength": 92,
 *       "accuracy": 88
 *     }
 *   }
 *
 * Returns null when invalid.
 */
import { isValidPositionGroup } from "../position-groups";
import type { NormalizedSource } from "./types";

export function normalizeAdminJson(
  payload: unknown,
): NormalizedSource | null {
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

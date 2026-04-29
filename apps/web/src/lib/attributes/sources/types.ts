import type { PositionGroup } from "../position-groups";

/**
 * Canonical normalizer output. Every source adapter
 * (PFF / Madden / admin JSON) returns this shape on success, null on
 * malformed input.
 */
export interface NormalizedSource {
  positionGroup: PositionGroup;
  attributes: Record<string, number>;
}

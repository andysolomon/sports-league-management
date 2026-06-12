/**
 * Madden-style headline attribute columns for the roster table
 * (WSM-000090). `attributesJson` keys are source-defined (PFF/Madden/
 * admin uploads), so nothing here is guaranteed to exist — a column
 * renders only when at least one player in the visible set has the
 * key. Keys are matched case-insensitively against the snapshot map.
 */

export interface PlayerSnapshot {
  weightedOverall: number | null;
  attributes: Record<string, number>;
}

/** Generic headline set; per-group tuning is config-only later. */
export const HEADLINE_ATTRIBUTE_KEYS = [
  "SPD",
  "STR",
  "AGI",
  "AWR",
] as const;

export function lookupAttribute(
  snapshot: PlayerSnapshot | undefined,
  key: string,
): number | null {
  if (!snapshot) return null;
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(snapshot.attributes)) {
    if (k.toLowerCase() === target) return v;
  }
  return null;
}

/**
 * The headline keys worth rendering for a set of players: a column
 * appears only if at least one visible player has a value for it.
 */
export function presentHeadlineKeys(
  snapshots: ReadonlyMap<string, PlayerSnapshot>,
  playerIds: readonly string[],
): string[] {
  return HEADLINE_ATTRIBUTE_KEYS.filter((key) =>
    playerIds.some(
      (id) => lookupAttribute(snapshots.get(id), key) !== null,
    ),
  );
}

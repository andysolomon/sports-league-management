/**
 * Human labels for SPRT rating component keys (WSM-000093). The keys are
 * produced by the rating model (lib/ratings/sprt.ts); this maps them to
 * display text for the profile breakdown. Unknown keys fall back to a
 * title-cased / camelCase-split form so a new component never renders as
 * a raw identifier.
 */
const LABELS: Record<string, string> = {
  efficiency: "Efficiency",
  production: "Production",
  scoring: "Scoring",
  mobility: "Mobility",
  rushEff: "Rush Efficiency",
  volume: "Volume",
  receiving: "Receiving",
  explosiveness: "Explosiveness",
  hands: "Hands",
  passRush: "Pass Rush",
  pressure: "Pressure",
  runStop: "Run Stop",
  tackling: "Tackling",
  coverage: "Coverage",
  ballHawk: "Ball Hawk",
  OVR: "Overall",
};

export function componentLabel(key: string): string {
  const known = LABELS[key];
  if (known) return known;
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Orders component entries for display: OVR is handled separately by the
 * caller, so this drops it and sorts the rest by value descending (the
 * player's strengths first).
 */
export function orderedComponents(
  attributes: Record<string, number>,
): Array<{ key: string; label: string; value: number }> {
  return Object.entries(attributes)
    .filter(([key]) => key !== "OVR")
    .map(([key, value]) => ({ key, label: componentLabel(key), value }))
    .sort((a, b) => b.value - a.value);
}

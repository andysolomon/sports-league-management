/**
 * Roster-match keys for Madden ingest (WSM-000095). The Madden sheet has no
 * shared id with our ESPN-sourced roster, so we join on normalized
 * name + team. Normalization lowercases, strips generational suffixes and
 * punctuation, and collapses whitespace so "Ja'Marr Chase" / "JaMarr Chase"
 * and "Michael Pittman Jr." / "Michael Pittman" line up.
 */
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function normalizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[.'’`]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter((p) => !SUFFIXES.has(p));
  return parts.join(" ");
}

export function normalizeTeam(team: string): string {
  return team
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Composite join key: "first last|city nickname". */
export function rosterMatchKey(name: string, team: string): string {
  return `${normalizeName(name)}|${normalizeTeam(team)}`;
}

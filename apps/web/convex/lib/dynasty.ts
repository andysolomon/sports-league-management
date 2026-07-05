/**
 * Dynasty rollover helpers (Convex layer). Pure functions only — no DB access.
 */

/** Varsity/JV from grade + player id (deterministic; mirrors synthetic-roster intent). */
export function squadForGrade(grade: number, playerId: string): string {
  if (grade >= 11) return "Varsity";
  let h = 2166136261;
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const frac = ((h >>> 0) % 1000) / 1000;
  return frac < 0.5 ? "Varsity" : "JV";
}

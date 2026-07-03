/*
 * Tiny mm:ss (or hh:mm:ss) timecode helpers for the clip-range inputs
 * (WSM-000201). Pure + dependency-free so they're trivially unit-testable.
 */

/** Parse "SS", "MM:SS", or "HH:MM:SS" into whole seconds; null if malformed.
 *  Minute/second segments past the first must be 0–59. */
export function parseTimecode(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length > 3) return null;
  const nums = parts.map((p) => (/^\d{1,4}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n))) return null;
  // Every segment after the leading one is a base-60 position.
  if (nums.slice(1).some((n) => n > 59)) return null;
  return nums.reduce((total, n) => total * 60 + n, 0);
}

/** Format whole seconds as "M:SS" (or "H:MM:SS" past an hour). */
export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mmss = `${minutes}:${String(seconds).padStart(2, "0")}`;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : mmss;
}

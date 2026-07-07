/**
 * Offseason free-agency helpers (WSM-000231).
 *
 * Target roster size matches the synthetic-roster generator cap in
 * `apps/web/src/app/dashboard/_actions/synthetic-rosters.ts` and dynasty rollover
 * (`DEFAULT_ROSTER_SIZE` = 48, clamped to `MAX_ROSTER_SIZE` = 60).
 */
export const DEFAULT_TARGET_ROSTER_SIZE = 48;
export const MAX_TARGET_ROSTER_SIZE = 60;

export function targetRosterSize(override?: number | null): number {
  const raw = override ?? DEFAULT_TARGET_ROSTER_SIZE;
  return Math.max(1, Math.min(raw, MAX_TARGET_ROSTER_SIZE));
}

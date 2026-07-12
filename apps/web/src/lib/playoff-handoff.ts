/*
 * WSM-000239 — season-safe playoff handoff gating for the schedule page.
 * WSM-000241 — start readiness requires a standard 4/8/16 playoff field.
 *
 * Pure so the read-only "waiting" branch has deterministic unit coverage (the
 * e2e environment has no viewer-role Clerk user, so this branch cannot be
 * driven end-to-end — see schedules e2e spec notes).
 */
import { canStartPlayoffs } from "@/lib/playoffs";

export type PlayoffHandoffState = "start" | "waiting" | "hidden";

export interface PlayoffHandoffInput {
  /** playoffs_v1 flag. */
  playoffsEnabled: boolean;
  /** The season the page is currently viewing (via ?season= or fallback). */
  viewedSeasonId: string | null;
  viewedSeasonStatus: string | null;
  /** The lifecycle-decided season (resolveLifecycleSeason over all seasons). */
  decidedSeasonId: string | null;
  /** Season playoff config; <2 means playoffs are not configured. */
  playoffTeams: number | null | undefined;
  /** Regular-season fixture count — an empty schedule never offers a handoff. */
  regularTotal: number;
  /** Every regular-season fixture is final or cancelled. */
  regularComplete: boolean;
  bracketExists: boolean;
  /** canManageRoster(role) — admins and coaches may start playoffs. */
  canManage: boolean;
}

/**
 * - "start"   — render the interactive Start-playoffs button.
 * - "waiting" — readiness holds but the viewer can't manage: render the
 *               non-interactive "waiting for playoffs to start" state.
 * - "hidden"  — no handoff surface at all (wrong/completed season, playoffs
 *               not configured, season not finished, or bracket already live).
 */
export function resolvePlayoffHandoff(
  input: PlayoffHandoffInput,
): PlayoffHandoffState {
  if (!input.playoffsEnabled) return "hidden";
  if (!input.viewedSeasonId) return "hidden";
  // Season-safety: only the lifecycle-decided ACTIVE season may hand off.
  // Viewing a historical or upcoming season never surfaces the button.
  if (input.viewedSeasonId !== input.decidedSeasonId) return "hidden";
  if (input.viewedSeasonStatus !== "active") return "hidden";
  if (!canStartPlayoffs(input.playoffTeams)) return "hidden";
  if (input.regularTotal === 0 || !input.regularComplete) return "hidden";
  if (input.bracketExists) return "hidden";
  return input.canManage ? "start" : "waiting";
}

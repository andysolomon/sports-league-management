/**
 * Intra-org capability roles (WSM-000121).
 *
 * Three tiers layered on Clerk org membership:
 *   - admin  — full control: league CRUD, members/invites, visibility,
 *              roster-lock, team deletion, plus everything a coach can do.
 *   - coach  — manage players (CRUD), rosters, depth charts, and
 *              schedules/results. No org/league settings or member management.
 *   - viewer — read-only. The least-privilege default for new members.
 *
 * Clerk owns membership + the admin bit (`org:admin`). The coach/viewer split
 * for `org:member` users is persisted in Convex (`orgMemberRoles`); a missing
 * row means viewer. This module is the single source of truth for "what can
 * this role do" — enforcement sites call these predicates instead of comparing
 * role strings inline, so the policy lives in one place.
 */
export type OrgRole = "admin" | "coach" | "viewer";

export const ORG_ROLES: readonly OrgRole[] = ["admin", "coach", "viewer"];

export function isOrgRole(value: unknown): value is OrgRole {
  return value === "admin" || value === "coach" || value === "viewer";
}

/** League/org settings: create/rename/delete league, members, invites,
 *  visibility toggle, roster lock, team deletion. Admin only. */
export function canManageOrgSettings(role: OrgRole | null): boolean {
  return role === "admin";
}

/** Day-to-day team operations: player CRUD, team edit, roster assignment,
 *  depth charts, schedules/results. Admin or coach. */
export function canManageRoster(role: OrgRole | null): boolean {
  return role === "admin" || role === "coach";
}

/** Any seat in the org can view. */
export function canView(role: OrgRole | null): boolean {
  return role !== null;
}

/** Human-readable label for a role (for badges/selects). */
export function roleLabel(role: OrgRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

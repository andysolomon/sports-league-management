import {
  canManageOrgSettings,
  canManageRoster,
  canView,
  ORG_ROLES,
  type OrgRole,
} from "./permissions";

/**
 * The roles & permissions reference (WSM-000131, #249).
 *
 * Each capability is gated by the SAME predicate that enforces it in
 * `permissions.ts` — the grid is computed by calling that predicate per role, so
 * the docs matrix can't drift from the policy. Add a capability here by pointing
 * it at the predicate that guards it; the ✓/✗ columns follow automatically.
 */
export interface RoleCapability {
  label: string;
  detail: string;
  gate: (role: OrgRole) => boolean;
}

export const ROLE_CAPABILITIES: readonly RoleCapability[] = [
  {
    label: "View everything",
    detail: "Leagues, teams, rosters, depth charts, schedules & standings.",
    gate: canView,
  },
  {
    label: "Manage players",
    detail: "Add, edit and remove players.",
    gate: canManageRoster,
  },
  {
    label: "Manage rosters & depth charts",
    detail: "Assign players to a roster and order depth charts.",
    gate: canManageRoster,
  },
  {
    label: "Edit team details",
    detail: "Names, colors, venue and the jersey policy.",
    gate: canManageRoster,
  },
  {
    label: "Manage schedules & results",
    detail: "Create fixtures and enter game results.",
    gate: canManageRoster,
  },
  {
    label: "Create, rename & delete leagues",
    detail: "Full league CRUD.",
    gate: canManageOrgSettings,
  },
  {
    label: "Manage members & invites",
    detail: "Invite people and assign their role.",
    gate: canManageOrgSettings,
  },
  {
    label: "Change league visibility",
    detail: "Toggle the public viewer link on or off.",
    gate: canManageOrgSettings,
  },
  {
    label: "Lock / unlock rosters",
    detail: "Freeze a season's rosters against edits.",
    gate: canManageOrgSettings,
  },
  {
    label: "Delete teams",
    detail: "Permanently remove a team and its roster.",
    gate: canManageOrgSettings,
  },
] as const;

export interface RoleSummary {
  role: OrgRole;
  blurb: string;
}

export const ROLE_SUMMARIES: readonly RoleSummary[] = [
  {
    role: "admin",
    blurb:
      "Full control — league CRUD, members & invites, visibility, roster lock and team deletion, plus everything a coach can do.",
  },
  {
    role: "coach",
    blurb:
      "Day-to-day team operations — players, rosters, depth charts and schedules/results. No org or league settings.",
  },
  {
    role: "viewer",
    blurb:
      "Read-only access to the whole workspace. The least-privilege default for every new member.",
  },
] as const;

/** A capability row with a resolved ✓/✗ per role, in ORG_ROLES order. */
export interface CapabilityRow {
  label: string;
  detail: string;
  allowed: Record<OrgRole, boolean>;
}

/** Compute the full matrix by evaluating each capability's gate per role. */
export function capabilityGrid(): CapabilityRow[] {
  return ROLE_CAPABILITIES.map((cap) => ({
    label: cap.label,
    detail: cap.detail,
    allowed: ORG_ROLES.reduce(
      (acc, role) => {
        acc[role] = cap.gate(role);
        return acc;
      },
      {} as Record<OrgRole, boolean>,
    ),
  }));
}

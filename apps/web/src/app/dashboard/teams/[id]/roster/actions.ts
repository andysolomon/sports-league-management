"use server";

import { auth } from "@clerk/nextjs/server";
import { rosterSnapshotsV1 } from "@/lib/flags";
import {
  assignPlayerToRoster as assignPlayerToRosterMutation,
  removePlayerFromRoster as removePlayerFromRosterMutation,
  updateRosterStatus as updateRosterStatusMutation,
  getLeagueOrgId,
} from "@/lib/data-api";
import { getUserRoleInOrg } from "@/lib/org-context";
import {
  trackRosterAssign,
  trackRosterLimitBlocked,
  trackRosterRemove,
  trackRosterStatusChange,
} from "@/lib/analytics";
import type { RosterAssignmentDto } from "@sports-management/shared-types";

async function requireFlag() {
  const enabled = await rosterSnapshotsV1();
  if (!enabled) throw new Error("flag_disabled");
}

async function requireOrgMembership(orgId: string, userId: string) {
  const role = await getUserRoleInOrg(orgId, userId);
  if (!role) throw new Error("not_authorized");
  return role;
}

export async function assignPlayerToRosterAction(input: {
  seasonId: string;
  teamId: string;
  leagueId: string;
  playerId: string;
  positionSlot: string;
}): Promise<RosterAssignmentDto> {
  await requireFlag();
  const { userId } = await auth();
  if (!userId) throw new Error("not_authenticated");

  const orgId = await getLeagueOrgId(input.leagueId);
  if (!orgId) throw new Error("not_authorized");
  await requireOrgMembership(orgId, userId);

  try {
    const result = await assignPlayerToRosterMutation({
      seasonId: input.seasonId,
      teamId: input.teamId,
      playerId: input.playerId,
      positionSlot: input.positionSlot,
      actorUserId: userId,
    });
    void trackRosterAssign({
      seasonId: input.seasonId,
      teamId: input.teamId,
      positionSlot: input.positionSlot,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("roster_limit_exceeded")) {
      void trackRosterLimitBlocked({
        seasonId: input.seasonId,
        teamId: input.teamId,
      });
    }
    throw err;
  }
}

export async function removePlayerFromRosterAction(input: {
  assignmentId: string;
  seasonId: string;
  teamId: string;
  leagueId: string;
  positionSlot: string;
}): Promise<void> {
  await requireFlag();
  const { userId } = await auth();
  if (!userId) throw new Error("not_authenticated");

  const orgId = await getLeagueOrgId(input.leagueId);
  if (!orgId) throw new Error("not_authorized");
  await requireOrgMembership(orgId, userId);

  await removePlayerFromRosterMutation({
    assignmentId: input.assignmentId,
    actorUserId: userId,
  });
  void trackRosterRemove({
    seasonId: input.seasonId,
    teamId: input.teamId,
    positionSlot: input.positionSlot,
  });
}

export async function updateRosterStatusAction(input: {
  assignmentId: string;
  seasonId: string;
  teamId: string;
  leagueId: string;
  fromStatus: string;
  newStatus: string;
}): Promise<RosterAssignmentDto> {
  await requireFlag();
  const { userId } = await auth();
  if (!userId) throw new Error("not_authenticated");

  const orgId = await getLeagueOrgId(input.leagueId);
  if (!orgId) throw new Error("not_authorized");
  await requireOrgMembership(orgId, userId);

  const result = await updateRosterStatusMutation({
    assignmentId: input.assignmentId,
    newStatus: input.newStatus,
    actorUserId: userId,
  });
  void trackRosterStatusChange({
    seasonId: input.seasonId,
    teamId: input.teamId,
    fromStatus: input.fromStatus,
    toStatus: input.newStatus,
  });
  return result;
}

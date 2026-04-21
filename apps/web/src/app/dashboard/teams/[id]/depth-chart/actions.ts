"use server";

import { auth } from "@clerk/nextjs/server";
import { depthChartV1 } from "@/lib/flags";
import {
  reorderDepthChart as reorderDepthChartMutation,
  setRosterLocked as setRosterLockedMutation,
} from "@/lib/data-api";
import { getLeagueOrgId, getUserRoleInOrg } from "@/lib/org-context";
import {
  trackDepthChartReorder,
  trackSeasonLockToggle,
} from "@/lib/analytics";
import type { DepthChartEntryDto } from "@sports-management/shared-types";

async function requireFlag() {
  const enabled = await depthChartV1();
  if (!enabled) {
    throw new Error("flag_disabled");
  }
}

async function requireOrgMembership(orgId: string, userId: string) {
  const role = await getUserRoleInOrg(orgId, userId);
  if (!role) {
    throw new Error("not_authorized");
  }
  return role;
}

export async function reorderDepthChartAction(input: {
  teamId: string;
  seasonId: string;
  leagueId: string;
  positionSlot: string;
  playerIds: string[];
}): Promise<DepthChartEntryDto[]> {
  await requireFlag();
  const { userId } = await auth();
  if (!userId) throw new Error("not_authenticated");

  const orgId = await getLeagueOrgId(input.leagueId);
  if (!orgId) throw new Error("not_authorized");
  await requireOrgMembership(orgId, userId);

  const result = await reorderDepthChartMutation({
    teamId: input.teamId,
    seasonId: input.seasonId,
    positionSlot: input.positionSlot,
    playerIds: input.playerIds,
  });
  void trackDepthChartReorder({
    teamId: input.teamId,
    seasonId: input.seasonId,
    positionSlot: input.positionSlot,
    playerCount: input.playerIds.length,
  });
  return result;
}

export async function setRosterLockedAction(input: {
  seasonId: string;
  leagueId: string;
  locked: boolean;
}): Promise<{ seasonId: string; rosterLocked: boolean }> {
  await requireFlag();
  const { userId } = await auth();
  if (!userId) throw new Error("not_authenticated");

  const orgId = await getLeagueOrgId(input.leagueId);
  if (!orgId) throw new Error("not_authorized");
  const role = await requireOrgMembership(orgId, userId);
  if (role !== "org:admin") throw new Error("not_authorized");

  const result = await setRosterLockedMutation(input.seasonId, input.locked);
  void trackSeasonLockToggle({
    seasonId: input.seasonId,
    locked: result.rosterLocked,
  });
  return result;
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { depthChartV1 } from "@/lib/flags";
import {
  reorderDepthChart as reorderDepthChartMutation,
  setRosterLocked as setRosterLockedMutation,
  getLeagueOrgId,
} from "@/lib/data-api";
import { resolveOrgRole } from "@/lib/org-context";
import { canManageRoster, canManageOrgSettings } from "@/lib/permissions";
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

// Editing the depth chart needs a manager seat (admin or coach) — viewers are
// read-only (WSM-000121).
async function requireRosterManager(orgId: string, userId: string) {
  const role = await resolveOrgRole(orgId, userId);
  if (!canManageRoster(role)) throw new Error("not_authorized");
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
  await requireRosterManager(orgId, userId);

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

  // Locking a season's roster is an admin-only structural action (WSM-000121).
  const orgId = await getLeagueOrgId(input.leagueId);
  if (!orgId) throw new Error("not_authorized");
  const role = await resolveOrgRole(orgId, userId);
  if (!canManageOrgSettings(role)) throw new Error("not_authorized");

  const result = await setRosterLockedMutation(input.seasonId, input.locked);
  void trackSeasonLockToggle({
    seasonId: input.seasonId,
    locked: result.rosterLocked,
  });
  return result;
}

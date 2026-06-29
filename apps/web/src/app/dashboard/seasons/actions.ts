"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  upsertSeason,
  updateSeason as updateSeasonMutation,
  setActiveSeason as setActiveSeasonMutation,
  deleteSeason as deleteSeasonMutation,
  copySeasonRosters,
  getSeasonLeagueId,
  getLeagueOrgId,
  getSeasons,
} from "@/lib/data-api";
import { getUserRoleInOrg } from "@/lib/org-context";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

/** Org-admin gate for a season's league. Mirrors requireLeagueAdmin in leagues/actions.ts. */
async function requireLeagueAdmin(
  leagueId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!leagueId) return { ok: false, error: "This season can't be edited." };
  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "This league can't be edited." };
  const role = await getUserRoleInOrg(orgId, userId);
  if (role !== "org:admin") return { ok: false, error: "not_admin" };
  return { ok: true };
}

export async function createSeasonAction(input: {
  leagueId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  playoffTeams?: number;
  playoffFormat?: string;
  divisionWinnersQualify?: boolean;
}): Promise<Result<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Season name is required." };
  const gate = await requireLeagueAdmin(input.leagueId);
  if (!gate.ok) return gate;

  try {
    // The league's first season becomes active so season-scoped features
    // (rosters, attributes, schedules) are immediately usable.
    const existing = await getSeasons([input.leagueId]);
    const status = existing.some((s) => s.status === "active")
      ? "upcoming"
      : "active";
    const { dto } = await upsertSeason({
      name,
      leagueId: input.leagueId,
      startDate: input.startDate,
      endDate: input.endDate,
      status,
      playoffTeams: input.playoffTeams,
      playoffFormat: input.playoffFormat ?? "single",
      divisionWinnersQualify: input.divisionWinnersQualify,
    });
    revalidatePath("/dashboard/seasons");
    return { ok: true, id: dto.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create season.",
    };
  }
}

export async function updateSeasonAction(input: {
  seasonId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  playoffTeams?: number;
  playoffFormat?: string;
  divisionWinnersQualify?: boolean;
}): Promise<Result> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Season name is required." };
  const leagueId = await getSeasonLeagueId(input.seasonId);
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;

  try {
    await updateSeasonMutation({
      seasonId: input.seasonId,
      name,
      startDate: input.startDate,
      endDate: input.endDate,
      playoffTeams: input.playoffTeams,
      playoffFormat: input.playoffFormat,
      divisionWinnersQualify: input.divisionWinnersQualify,
    });
    revalidatePath("/dashboard/seasons");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update season.",
    };
  }
}

export async function activateSeasonAction(seasonId: string): Promise<Result> {
  const leagueId = await getSeasonLeagueId(seasonId);
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;
  await setActiveSeasonMutation(seasonId);
  revalidatePath("/dashboard/seasons");
  return { ok: true };
}

export async function deleteSeasonAction(seasonId: string): Promise<Result> {
  const leagueId = await getSeasonLeagueId(seasonId);
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;
  await deleteSeasonMutation(seasonId);
  revalidatePath("/dashboard/seasons");
  return { ok: true };
}

/*
 * Roster carryover (WSM-000163). Clone the most recent prior season's rosters
 * into the target season. The mutation refuses to overwrite a target that
 * already has rosters; that surfaces here as `needsConfirm` so the UI can
 * re-call with `confirm: true`. A league with no prior season maps to a
 * friendly error.
 */
export async function copyRostersAction(input: {
  targetSeasonId: string;
  confirm?: boolean;
}): Promise<
  | { ok: true; copiedAssignments: number; copiedDepthEntries: number }
  | { ok: false; needsConfirm: true }
  | { ok: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const leagueId = await getSeasonLeagueId(input.targetSeasonId);
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;

  try {
    const res = await copySeasonRosters({
      targetSeasonId: input.targetSeasonId,
      actorUserId: userId,
      confirm: input.confirm,
    });
    revalidatePath("/dashboard/seasons");
    return {
      ok: true,
      copiedAssignments: res.copiedAssignments,
      copiedDepthEntries: res.copiedDepthEntries,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("target_has_rosters")) {
      return { ok: false, needsConfirm: true };
    }
    if (message.includes("no_source_season")) {
      return {
        ok: false,
        error: "This league has no earlier season to copy rosters from.",
      };
    }
    return { ok: false, error: message };
  }
}

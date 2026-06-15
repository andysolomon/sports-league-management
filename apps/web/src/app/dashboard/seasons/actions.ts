"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  upsertSeason,
  updateSeason as updateSeasonMutation,
  setActiveSeason as setActiveSeasonMutation,
  deleteSeason as deleteSeasonMutation,
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

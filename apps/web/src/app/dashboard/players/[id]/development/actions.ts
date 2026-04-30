"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { playerAttributesV1 } from "@/lib/flags";
import {
  ingestPlayerAttributes,
  getTeamLeagueId,
  getLeagueOrgId,
  getPlayer,
} from "@/lib/data-api";
import { getUserRoleInOrg, resolveOrgContext } from "@/lib/org-context";
import { trackPlayerAttributesIngest } from "@/lib/analytics";

export type AttributeSource = "pff" | "madden" | "admin";

interface IngestActionInput {
  playerId: string;
  seasonId: string;
  source: AttributeSource;
  rawJson: string;
  pffWeight?: number;
  maddenWeight?: number;
}

/**
 * Server action — admin uploads a single player's attributes for a
 * season via the AttributesUploadDialog.
 *
 * Auth chain:
 *   - playerAttributesV1 must be on
 *   - Clerk session present
 *   - Player must be visible to the user (resolveOrgContext)
 *   - Caller must be org:admin of the league owning the player's team
 *
 * Parses the raw JSON paste, dispatches to the matching adapter via
 * the data-api ingestPlayerAttributes wrapper (which runs the
 * normalize + weighted-overall computation client-side).
 */
export async function ingestPlayerAttributesAction(
  input: IngestActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const enabled = await playerAttributesV1();
  if (!enabled) return { ok: false, error: "flag_disabled" };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  // Resolve player + league + org for the auth chain.
  const orgContext = await resolveOrgContext(userId);
  const player = await getPlayer(input.playerId, orgContext).catch(
    () => null,
  );
  if (!player) return { ok: false, error: "player_not_found" };

  const leagueId = await getTeamLeagueId(player.teamId).catch(() => null);
  if (!leagueId) return { ok: false, error: "league_not_found" };

  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "league_not_owned" };

  const role = await getUserRoleInOrg(orgId, userId);
  if (role !== "org:admin") return { ok: false, error: "not_admin" };

  // Parse raw JSON.
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawJson);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  try {
    await ingestPlayerAttributes({
      playerId: input.playerId,
      seasonId: input.seasonId,
      pffSource: input.source === "pff" ? parsed : undefined,
      maddenSource: input.source === "madden" ? parsed : undefined,
      adminSource: input.source === "admin" ? parsed : undefined,
      pffWeight: input.pffWeight,
      maddenWeight: input.maddenWeight,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  void trackPlayerAttributesIngest({
    playerId: input.playerId,
    seasonId: input.seasonId,
    source: input.source,
  });

  revalidatePath(`/dashboard/players/${input.playerId}/development`);
  return { ok: true };
}

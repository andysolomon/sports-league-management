"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  advanceOffseasonPhase,
  beginOffseason,
  getDraft,
  getLeagueOrgId,
  type OffseasonDto,
} from "@/lib/data-api";
import type { DraftPhaseStatus } from "@/lib/dynasty/offseason-phases";

/*
 * Advancing the offseason is an ORG-ADMIN action (B1).
 *
 * A phase change moves every team in the league at once — it closes the draft
 * window on all of them, or opens free agency for all of them. It is not a
 * per-team action, so it does not route through `authorizeTeamMutation`. The
 * per-team authorization the roadmap requires is for the phase CONTENTS
 * (scouting, training, promotions) that B3–B6 add, where each coach acts on
 * their own roster.
 */

export type OffseasonActionResult =
  | { ok: true; offseason: OffseasonDto; changed: boolean }
  | { ok: false; error: string };

async function requireLeagueAdmin(leagueId: string): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const orgId = await getLeagueOrgId(leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  if (!canManageOrgSettings(role)) return null;
  const orgContext = await resolveOrgContext(userId);
  if (!orgContext.visibleLeagueIds.includes(leagueId)) return null;
  return userId;
}

function draftStatusFor(
  draft: { status: string } | null,
): DraftPhaseStatus {
  if (!draft) return "none";
  return draft.status === "complete" ? "complete" : "active";
}

export async function openOffseasonAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<OffseasonActionResult> {
  const userId = await requireLeagueAdmin(input.leagueId);
  if (!userId) return { ok: false, error: "not_authorized" };

  try {
    const offseason = await beginOffseason({
      seasonId: input.seasonId,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/seasons/${input.seasonId}`);
    revalidatePath(`/dashboard/seasons/${input.seasonId}/offseason`);
    return { ok: true, offseason, changed: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export async function advanceOffseasonPhaseAction(input: {
  leagueId: string;
  seasonId: string;
  expectedPhase: string;
  to: string;
}): Promise<OffseasonActionResult> {
  const userId = await requireLeagueAdmin(input.leagueId);
  if (!userId) return { ok: false, error: "not_authorized" };

  try {
    /*
     * Open on demand so the row's existence is never something the UI has to
     * orchestrate. `beginOffseason` is idempotent, so this is a no-op for every
     * season that already has one.
     */
    await beginOffseason({ seasonId: input.seasonId, actorUserId: userId });

    /*
     * Draft status is read HERE and passed in, rather than read inside the
     * mutation. The gate needs it, and `drafts` is queried by season through a
     * function the Next layer already owns — reaching into it from the dynasty
     * module would couple two Convex modules for one boolean.
     */
    const draft = await getDraft(input.seasonId).catch(() => null);

    const result = await advanceOffseasonPhase({
      seasonId: input.seasonId,
      expectedPhase: input.expectedPhase,
      to: input.to,
      // Identifies this attempt, so a retry by the same admin is not mistaken
      // for a second admin racing them.
      ownerId: `${userId}:${input.expectedPhase}:${input.to}`,
      actorUserId: userId,
      draftStatus: draftStatusFor(draft),
    });

    revalidatePath(`/dashboard/seasons/${input.seasonId}`);
    revalidatePath(`/dashboard/seasons/${input.seasonId}/offseason`);
    return { ok: true, offseason: result.offseason, changed: result.changed };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

/**
 * Convex wraps a thrown `Error` in its own message, so the bare reason a
 * caller needs (`phase_busy`, `draft_in_progress`) has to be recovered from
 * the text rather than read off a field.
 */
function messageOf(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const known = [
    "phase_busy",
    "phase_regression",
    "phase_out_of_order",
    "draft_in_progress",
    "unknown_phase",
    "offseason_not_found",
    "season_not_upcoming",
    "season_not_found",
  ];
  return known.find((code) => raw.includes(code)) ?? "advance_failed";
}

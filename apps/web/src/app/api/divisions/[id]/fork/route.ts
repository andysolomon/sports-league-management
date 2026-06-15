import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { forkDivisionToWorkspace } from "@/lib/data-api";
import { handleApiError } from "@/lib/api-error";
import { resolveForkTargetOrg } from "@/lib/fork-target-org";

/**
 * Add a whole division to the caller's workspace (WSM-000133) — fork EVERY team
 * in the reference division into their PRIVATE workspace in one idempotent
 * action. Resolves the target org exactly like per-team claim (active admin org,
 * else any admin org, else org-on-claim). Already-forked teams are skipped, so
 * re-running over a partially-added division adds only the remaining teams.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: divisionId } = await params;
    const body = await request.json().catch(() => ({}));
    const orgName =
      typeof body?.teamName === "string" && body.teamName.trim()
        ? body.teamName.trim()
        : "My Team";

    const { targetOrgId, createdOrg } = await resolveForkTargetOrg({
      userId,
      orgId,
      orgRole,
      newOrgName: orgName,
    });

    const { leagueId, totalTeams, forkedTeams, alreadyForked } =
      await forkDivisionToWorkspace(targetOrgId, divisionId);

    return NextResponse.json({
      message: "Added",
      leagueId,
      orgId: targetOrgId,
      createdOrg,
      totalTeams,
      forkedTeams,
      alreadyForked,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not forkable")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return handleApiError(error, "/api/divisions/[id]/fork");
  }
}

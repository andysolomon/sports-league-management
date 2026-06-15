import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { forkConferenceToWorkspace } from "@/lib/data-api";
import { handleApiError } from "@/lib/api-error";
import { resolveForkTargetOrg } from "@/lib/fork-target-org";

/**
 * Add a whole conference to the caller's workspace (WSM-000133, optimal AC) —
 * fork every team in every division under the reference conference, in one
 * idempotent action. Org resolution + idempotency mirror the division route.
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
    const { id: conferenceId } = await params;
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
      await forkConferenceToWorkspace(targetOrgId, conferenceId);

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
    return handleApiError(error, "/api/conferences/[id]/fork");
  }
}

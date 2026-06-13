import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { claimTeamForOrg } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * Claim a team into the caller's active organization (WSM-000110). Requires an
 * active org and org:admin (enforced in claimTeamForOrg). On success the team
 * is owned + editable by the org and subscribed (scoped) for the user.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json(
      {
        error:
          "Select or create an organization before claiming a team — it becomes the owner.",
      },
      { status: 400 },
    );
  }

  try {
    const { id: teamId } = await params;
    const { leagueId } = await claimTeamForOrg(userId, orgId, teamId);
    return NextResponse.json({ message: "Claimed", leagueId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Friendly status for the expected rejections.
    if (msg.includes("admin")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not claimable") || msg.includes("already claimed")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return handleApiError(error, "/api/teams/[id]/claim");
  }
}

import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { claimTeam } from "@/lib/data-api";
import { claimTeamForOrg } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * Claim a team (WSM-000110/111). Resolves an org the user admins to own the
 * team — never making them set one up first:
 *   1. the active org, if they admin it; else
 *   2. any org they already admin; else
 *   3. a freshly created org (they become its admin) — org-on-claim onboarding.
 * Then sets the team's owner to that org and subscribes the user (scoped).
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
    const { id: teamId } = await params;
    const body = await request.json().catch(() => ({}));
    const teamName =
      typeof body?.teamName === "string" && body.teamName.trim()
        ? body.teamName.trim()
        : "My Team";

    const client = await clerkClient();
    let createdOrg = false;
    let targetOrgId: string;

    if (orgId && orgRole === "org:admin") {
      targetOrgId = orgId;
    } else {
      const memberships = await client.users.getOrganizationMembershipList({
        userId,
      });
      const adminMembership = memberships.data.find(
        (m) => m.role === "org:admin",
      );
      if (adminMembership) {
        targetOrgId = adminMembership.organization.id;
      } else {
        // Org-on-claim: stand up the coach's organization behind the scenes.
        const org = await client.organizations.createOrganization({
          name: teamName,
          createdBy: userId,
        });
        targetOrgId = org.id;
        createdOrg = true;
      }
    }

    // For a just-created org we already know the user is its admin, so skip the
    // redundant (and possibly not-yet-propagated) membership re-check.
    const { leagueId } = createdOrg
      ? await claimTeam(userId, targetOrgId, teamId)
      : await claimTeamForOrg(userId, targetOrgId, teamId);

    return NextResponse.json({
      message: "Claimed",
      leagueId,
      orgId: targetOrgId,
      createdOrg,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("admin")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not claimable") || msg.includes("already claimed")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return handleApiError(error, "/api/teams/[id]/claim");
  }
}

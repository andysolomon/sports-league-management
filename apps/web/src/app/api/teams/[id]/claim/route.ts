import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { forkTeamToWorkspace } from "@/lib/data-api";
import { handleApiError } from "@/lib/api-error";

/**
 * Add a team to the caller's org — forking it into their PRIVATE workspace
 * (WSM-000110/111/115). Resolves an org the user admins, never making them set
 * one up first:
 *   1. the active org, if they admin it; else
 *   2. any org they already admin; else
 *   3. a freshly created org (they become its admin) — org-on-claim onboarding.
 * Then forks the reference team (+ roster) into that org's workspace and returns
 * the workspace team to redirect to (the editable copy).
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

    // targetOrgId is always an org this user admins (active/found/just-created),
    // so fork directly into it. Fork = a private editable copy of the team.
    const {
      teamId: workspaceTeamId,
      leagueId,
      created,
    } = await forkTeamToWorkspace(targetOrgId, teamId);

    return NextResponse.json({
      message: "Added",
      teamId: workspaceTeamId,
      leagueId,
      orgId: targetOrgId,
      createdOrg,
      created,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not forkable")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return handleApiError(error, "/api/teams/[id]/claim");
  }
}

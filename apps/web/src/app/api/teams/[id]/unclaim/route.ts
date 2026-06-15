import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { unforkTeamFromWorkspace } from "@/lib/data-api";
import { handleApiError } from "@/lib/api-error";

/**
 * Remove a team the caller previously added — the reverse of /claim
 * (WSM-000129). Deletes the caller's PRIVATE workspace fork of the reference
 * team (the editable copy + its roster). Resolves the SAME org Discover uses to
 * mark teams "Added" (active org, else first admin org) so what's shown as added
 * and what gets removed always agree; never creates an org. The fork only lives
 * in orgs the caller admins, so this is implicitly admin-scoped. Idempotent —
 * `removed: false` when no fork is found.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: sourceTeamId } = await params;

    let forkOrgId: string | null = orgId ?? null;
    if (!forkOrgId) {
      const client = await clerkClient();
      const memberships = await client.users.getOrganizationMembershipList({
        userId,
      });
      forkOrgId =
        memberships.data.find((m) => m.role === "org:admin")?.organization.id ??
        null;
    }

    if (!forkOrgId) {
      return NextResponse.json({ message: "Not added", removed: false });
    }

    const { removed } = await unforkTeamFromWorkspace(forkOrgId, sourceTeamId);
    return NextResponse.json({
      message: removed ? "Removed" : "Not added",
      removed,
    });
  } catch (error) {
    return handleApiError(error, "/api/teams/[id]/unclaim");
  }
}

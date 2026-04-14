import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/org-context";
import { removePendingRequest } from "@/lib/org-requests";
import { handleApiError } from "@/lib/api-error";

// Approve request
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; requestUserId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, requestUserId } = await params;

  try {
    await requireOrgAdmin(orgId, userId);

    const client = await clerkClient();
    await client.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId: requestUserId,
      role: "org:member",
    });

    await removePendingRequest(orgId, requestUserId);

    return NextResponse.json({ status: "approved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/requests/[requestUserId]");
  }
}

// Reject request
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; requestUserId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, requestUserId } = await params;

  try {
    await requireOrgAdmin(orgId, userId);

    await removePendingRequest(orgId, requestUserId);

    return NextResponse.json({ status: "rejected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/requests/[requestUserId]");
  }
}

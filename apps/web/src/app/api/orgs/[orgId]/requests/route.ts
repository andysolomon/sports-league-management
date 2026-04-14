import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/org-context";
import { getPendingRequests, addPendingRequest } from "@/lib/org-requests";
import { handleApiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  try {
    await requireOrgAdmin(orgId, userId);
    const requests = await getPendingRequests(orgId);
    return NextResponse.json(requests);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/requests");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  try {
    // Check user is not already a member
    const client = await clerkClient();
    const memberships = await client.users.getOrganizationMembershipList({ userId });
    const alreadyMember = memberships.data.some((m) => m.organization.id === orgId);
    if (alreadyMember) {
      return NextResponse.json({ error: "Already a member" }, { status: 400 });
    }

    // Get user email for the request record
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress ?? "";

    await addPendingRequest(orgId, userId, email);

    return NextResponse.json({ message: "Request submitted" }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "/api/orgs/[orgId]/requests");
  }
}

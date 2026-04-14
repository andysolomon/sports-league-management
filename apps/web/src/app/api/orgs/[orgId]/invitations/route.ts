import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/org-context";
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

    const client = await clerkClient();
    const invitations = await client.organizations.getOrganizationInvitationList({
      organizationId: orgId,
    });

    const data = invitations.data.map((inv) => ({
      id: inv.id,
      emailAddress: inv.emailAddress,
      status: inv.status,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/invitations");
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
    await requireOrgAdmin(orgId, userId);

    const body = await request.json();
    const { emailAddress } = body;

    if (!emailAddress || typeof emailAddress !== "string" || !emailAddress.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const client = await clerkClient();
    const invitation = await client.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress,
      role: "org:member",
      inviterUserId: userId,
    });

    return NextResponse.json(
      {
        id: invitation.id,
        emailAddress: invitation.emailAddress,
        status: invitation.status,
        createdAt: invitation.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/invitations");
  }
}

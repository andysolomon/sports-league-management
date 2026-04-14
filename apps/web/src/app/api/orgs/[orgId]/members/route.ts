import { auth, clerkClient } from "@clerk/nextjs/server";
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
    const memberships =
      await client.organizations.getOrganizationMembershipList({
        organizationId: orgId,
      });

    const data = memberships.data.map((m) => ({
      userId: m.publicUserData?.userId ?? "",
      email: m.publicUserData?.identifier ?? "",
      firstName: m.publicUserData?.firstName ?? "",
      lastName: m.publicUserData?.lastName ?? "",
      imageUrl: m.publicUserData?.imageUrl ?? "",
      role: m.role,
      createdAt: m.createdAt,
    }));

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/members");
  }
}

export async function PATCH(
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

    const { memberUserId, role } = await request.json();

    if (!memberUserId || !role || !["org:admin", "org:member"].includes(role)) {
      return NextResponse.json(
        { error: "Valid memberUserId and role required" },
        { status: 400 },
      );
    }

    // Prevent demoting last admin
    if (role === "org:member") {
      const client = await clerkClient();
      const memberships =
        await client.organizations.getOrganizationMembershipList({
          organizationId: orgId,
        });
      const adminCount = memberships.data.filter(
        (m) => m.role === "org:admin",
      ).length;
      if (adminCount <= 1) {
        const targetIsAdmin = memberships.data.find(
          (m) =>
            m.publicUserData?.userId === memberUserId &&
            m.role === "org:admin",
        );
        if (targetIsAdmin) {
          return NextResponse.json(
            { error: "Cannot demote the last admin" },
            { status: 400 },
          );
        }
      }
    }

    const client = await clerkClient();
    await client.organizations.updateOrganizationMembership({
      organizationId: orgId,
      userId: memberUserId,
      role,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/members");
  }
}

export async function DELETE(
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

    const { memberUserId } = await request.json();

    if (!memberUserId) {
      return NextResponse.json(
        { error: "memberUserId is required" },
        { status: 400 },
      );
    }

    // Prevent removing last admin
    const client = await clerkClient();
    const memberships =
      await client.organizations.getOrganizationMembershipList({
        organizationId: orgId,
      });
    const adminCount = memberships.data.filter(
      (m) => m.role === "org:admin",
    ).length;
    if (adminCount <= 1) {
      const targetIsAdmin = memberships.data.find(
        (m) =>
          m.publicUserData?.userId === memberUserId && m.role === "org:admin",
      );
      if (targetIsAdmin) {
        return NextResponse.json(
          { error: "Cannot remove the last admin" },
          { status: 400 },
        );
      }
    }

    await client.organizations.deleteOrganizationMembership({
      organizationId: orgId,
      userId: memberUserId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/members");
  }
}

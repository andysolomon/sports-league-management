import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/org-context";
import {
  listOrgMemberRoles,
  setOrgMemberRole,
  deleteOrgMemberRole,
} from "@/lib/data-api";
import { isOrgRole, type OrgRole } from "@/lib/permissions";
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

    // Layer the Convex coach/viewer sub-role onto Clerk membership: org:admin
    // → admin; org:member → stored sub-role, defaulting to viewer (WSM-000121).
    const subRoles = await listOrgMemberRoles(orgId).catch(() => []);
    const subRoleByUser = new Map(subRoles.map((r) => [r.userId, r.role]));

    const data = memberships.data.map((m) => {
      const memberUserId = m.publicUserData?.userId ?? "";
      const role: OrgRole =
        m.role === "org:admin"
          ? "admin"
          : (subRoleByUser.get(memberUserId) ?? "viewer");
      return {
        userId: memberUserId,
        email: m.publicUserData?.identifier ?? "",
        firstName: m.publicUserData?.firstName ?? "",
        lastName: m.publicUserData?.lastName ?? "",
        imageUrl: m.publicUserData?.imageUrl ?? "",
        role,
        createdAt: m.createdAt,
      };
    });

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

    if (!memberUserId || !isOrgRole(role)) {
      return NextResponse.json(
        { error: "Valid memberUserId and role (admin/coach/viewer) required" },
        { status: 400 },
      );
    }

    const client = await clerkClient();

    // Prevent demoting the last admin off the admin role.
    if (role !== "admin") {
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

    // Clerk owns the admin bit; Convex stores the coach/viewer split for members.
    if (role === "admin") {
      await client.organizations.updateOrganizationMembership({
        organizationId: orgId,
        userId: memberUserId,
        role: "org:admin",
      });
      await deleteOrgMemberRole(orgId, memberUserId);
    } else {
      await client.organizations.updateOrganizationMembership({
        organizationId: orgId,
        userId: memberUserId,
        role: "org:member",
      });
      await setOrgMemberRole(orgId, memberUserId, role);
    }

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
    // Drop any coach/viewer sub-role so a re-add starts clean (WSM-000121).
    await deleteOrgMemberRole(orgId, memberUserId).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/members");
  }
}

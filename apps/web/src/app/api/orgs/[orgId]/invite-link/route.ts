import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/org-context";
import { getLeagueForOrg, setLeagueInviteToken } from "@/lib/data-api";
import { handleApiError } from "@/lib/api-error";
import crypto from "crypto";

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
    const league = await getLeagueForOrg(orgId);
    if (!league) throw new Error("League not found for this organization");

    if (!league.token) {
      return NextResponse.json({ url: null, token: null });
    }

    return NextResponse.json({
      url: `/join/${league.token}`,
      token: league.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/invite-link");
  }
}

export async function POST(
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
    const league = await getLeagueForOrg(orgId);
    if (!league) throw new Error("League not found for this organization");

    const token = crypto.randomUUID();
    await setLeagueInviteToken(league.id, token);

    return NextResponse.json(
      { url: `/join/${token}`, token },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/invite-link");
  }
}

export async function DELETE(
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
    const league = await getLeagueForOrg(orgId);
    if (!league) throw new Error("League not found for this organization");

    await setLeagueInviteToken(league.id, null);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("must be an admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleApiError(error, "/api/orgs/[orgId]/invite-link");
  }
}

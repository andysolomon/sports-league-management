import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/org-context";
import { setLeagueInviteToken } from "@/lib/data-api";
import { getSalesforceConnection } from "@/lib/salesforce";
import { handleApiError } from "@/lib/api-error";
import crypto from "crypto";

// Find the league that belongs to this org
async function getLeagueForOrg(orgId: string): Promise<{ id: string; token: string | null }> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string; Invite_Token__c: string | null }>(
    `SELECT Id, Invite_Token__c FROM League__c WHERE Clerk_Org_Id__c = '${orgId}' LIMIT 1`,
  );
  if (result.totalSize === 0) throw new Error("League not found for this organization");
  return { id: result.records[0].Id, token: result.records[0].Invite_Token__c ?? null };
}

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

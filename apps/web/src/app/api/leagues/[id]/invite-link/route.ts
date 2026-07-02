import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/org-context";
import { setLeagueInviteToken, getLeagueInviteInfo } from "@/lib/data-api";
import { handleApiError } from "@/lib/api-error";
import crypto from "crypto";

// WSM-000199: invite links are keyed by league (the token lives on the league
// row). The old /api/orgs/[orgId]/invite-link 500'd for any org owning 2+
// leagues and was ambiguous about which league it linked to.
async function requireLeagueInviteAccess(
  leagueId: string,
  userId: string,
): Promise<{ token: string | null }> {
  const info = await getLeagueInviteInfo(leagueId);
  if (!info || !info.orgId) {
    // Missing league, or a league no org owns — nothing to invite into.
    throw new LeagueNotFoundError();
  }
  await requireOrgAdmin(info.orgId, userId);
  return { token: info.token };
}

class LeagueNotFoundError extends Error {
  constructor() {
    super("League not found");
  }
}

function errorResponse(error: unknown) {
  if (error instanceof LeagueNotFoundError) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("must be an admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return handleApiError(error, "/api/leagues/[id]/invite-link");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { token } = await requireLeagueInviteAccess(id, userId);

    if (!token) {
      return NextResponse.json({ url: null, token: null });
    }

    return NextResponse.json({ url: `/join/${token}`, token });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await requireLeagueInviteAccess(id, userId);

    const token = crypto.randomUUID();
    await setLeagueInviteToken(id, token);

    return NextResponse.json(
      { url: `/join/${token}`, token },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await requireLeagueInviteAccess(id, userId);

    await setLeagueInviteToken(id, null);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

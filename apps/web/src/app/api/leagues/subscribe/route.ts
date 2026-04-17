import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSalesforceConnection } from "@/lib/salesforce";
import { handleApiError } from "@/lib/api-error";

async function verifyPublicLeague(leagueId: string): Promise<boolean> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string }>(
    `SELECT Id FROM League__c WHERE Id = '${leagueId}' AND Clerk_Org_Id__c = null LIMIT 1`,
  );
  return result.totalSize > 0;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { leagueId } = await request.json();
    if (!leagueId || typeof leagueId !== "string") {
      return NextResponse.json(
        { error: "leagueId is required" },
        { status: 400 },
      );
    }

    const isPublic = await verifyPublicLeague(leagueId);
    if (!isPublic) {
      return NextResponse.json(
        { error: "League not found or not public" },
        { status: 404 },
      );
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const current =
      (user.publicMetadata?.subscribedLeagueIds as string[]) ?? [];

    if (current.includes(leagueId)) {
      return NextResponse.json({ message: "Already subscribed" });
    }

    await client.users.updateUser(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        subscribedLeagueIds: [...current, leagueId],
      },
    });

    return NextResponse.json({ message: "Subscribed" });
  } catch (error) {
    return handleApiError(error, "/api/leagues/subscribe");
  }
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { leagueId } = await request.json();
    if (!leagueId || typeof leagueId !== "string") {
      return NextResponse.json(
        { error: "leagueId is required" },
        { status: 400 },
      );
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const current =
      (user.publicMetadata?.subscribedLeagueIds as string[]) ?? [];

    await client.users.updateUser(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        subscribedLeagueIds: current.filter((id) => id !== leagueId),
      },
    });

    return NextResponse.json({ message: "Unsubscribed" });
  } catch (error) {
    return handleApiError(error, "/api/leagues/subscribe");
  }
}

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  subscribeToLeague,
  unsubscribeFromLeague,
} from "@/lib/data-api";
import { handleApiError } from "@/lib/api-error";

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

    // The Convex `subscribeToLeague` mutation enforces the public-league
    // check (throws "League not found or not public") and idempotently
    // writes to the `leagueSubscriptions` table. We surface the error
    // back to the client at 404 to preserve the prior contract.
    try {
      await subscribeToLeague(userId, leagueId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("not public")) {
        return NextResponse.json(
          { error: "League not found or not public" },
          { status: 404 },
        );
      }
      throw err;
    }

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

    await unsubscribeFromLeague(userId, leagueId);
    return NextResponse.json({ message: "Unsubscribed" });
  } catch (error) {
    return handleApiError(error, "/api/leagues/subscribe");
  }
}

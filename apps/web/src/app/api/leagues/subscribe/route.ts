import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getPublicLeagues,
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

    const publicLeague = (await getPublicLeagues()).find(
      (league) => league.id === leagueId,
    );
    if (!publicLeague) {
      return NextResponse.json(
        { error: "League not found or not public" },
        { status: 404 },
      );
    }

    await subscribeToLeague(userId, leagueId);
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

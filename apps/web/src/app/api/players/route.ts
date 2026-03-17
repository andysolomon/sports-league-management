import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getPlayers, getPlayersByTeam } from "@/lib/salesforce-api";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = request.nextUrl.searchParams.get("teamId");
  const data = teamId ? await getPlayersByTeam(teamId) : await getPlayers();
  return NextResponse.json(data);
}

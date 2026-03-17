import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTeam, getPlayersByTeam } from "@/lib/salesforce-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [team, players] = await Promise.all([
    getTeam(id),
    getPlayersByTeam(id),
  ]);
  return NextResponse.json({ team, players });
}

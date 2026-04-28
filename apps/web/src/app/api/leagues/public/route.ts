import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPublicLeagues } from "@/lib/data-api";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const leagues = await getPublicLeagues();
    return NextResponse.json(leagues);
  } catch (error) {
    return handleApiError(error, "/api/leagues/public");
  }
}

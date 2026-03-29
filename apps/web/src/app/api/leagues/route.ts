import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getLeagues } from "@/lib/salesforce-api";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await getLeagues();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "/api/leagues");
  }
}

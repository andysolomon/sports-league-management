import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSeasons } from "@/lib/salesforce-api";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await getSeasons();
  return NextResponse.json(data);
}

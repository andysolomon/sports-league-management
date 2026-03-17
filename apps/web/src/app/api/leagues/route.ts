import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getLeagues } from "@/lib/salesforce-api";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await getLeagues();
  return NextResponse.json(data);
}

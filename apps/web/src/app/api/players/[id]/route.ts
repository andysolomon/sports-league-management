import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlayer } from "@/lib/salesforce-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const data = await getPlayer(id);
  return NextResponse.json(data);
}

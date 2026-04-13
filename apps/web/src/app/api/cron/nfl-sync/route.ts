import type { NextRequest } from "next/server";
import { syncNfl } from "@/lib/sync/nfl-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — full 32-team sync

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const report = await syncNfl();
  return Response.json(report);
}

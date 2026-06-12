import type { NextRequest } from "next/server";
import { refreshSprtRatings } from "@/lib/ratings/sprt-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — nflverse fetch + per-league ingest

/**
 * Weekly SPRT rating refresh (WSM-000092). Pulls the latest nflverse
 * season and recomputes ratings for every public league's active
 * season. Bearer-auth via CRON_SECRET, matching the nfl-sync cron.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const report = await refreshSprtRatings();
    console.log(
      JSON.stringify({ level: "info", route: "/api/cron/sprt-refresh", report }),
    );
    return Response.json(report);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/cron/sprt-refresh",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return new Response("SPRT refresh failed", { status: 500 });
  }
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { syncNfl } from "@/lib/sync/nfl-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/import/nfl-sync
 *
 * Kicks off the ESPN NFL sync in the background and returns 202
 * immediately. A full sync upserts ~3k players and runs for minutes —
 * longer than mobile browsers and proxies will hold a single request
 * (WSM-000084). Clients poll /api/import/nfl-sync-config and compare
 * `lastSyncReport.startedAt` against the `requestedAt` returned here;
 * syncNfl persists its report (success or failure) when it finishes.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const requestedAt = new Date().toISOString();

  waitUntil(
    syncNfl({ skipToggleCheck: true }).catch((err: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/import/nfl-sync POST",
          message: `Background NFL sync failed before writing a report: ${
            err instanceof Error ? err.message : String(err)
          }`,
        }),
      );
    }),
  );

  return NextResponse.json({ accepted: true, requestedAt }, { status: 202 });
}

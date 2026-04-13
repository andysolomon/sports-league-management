import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncNfl } from "@/lib/sync/nfl-sync";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const authResult = await auth({
    acceptsToken: ["session_token", "api_key"],
  });

  if (authResult.tokenType === null || !authResult.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const report = await syncNfl({ skipToggleCheck: true });
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error, "/api/cli/import/nfl-sync POST");
  }
}

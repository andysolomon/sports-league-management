import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getLeagues } from "@/lib/salesforce-api";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/cli/leagues
 *
 * CLI-facing mirror of /api/leagues. Accepts both session cookies and
 * Clerk API keys (the middleware gates /api/cli/* to both token types).
 */
export async function GET() {
  const authResult = await auth({
    acceptsToken: ["session_token", "api_key"],
  });

  if (authResult.tokenType === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authResult.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = await getLeagues();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "/api/cli/leagues");
  }
}

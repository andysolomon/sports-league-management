import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSeasons } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

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
    const orgContext = await resolveOrgContext(authResult.userId);
    const data = await getSeasons(orgContext.visibleLeagueIds);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "/api/cli/seasons");
  }
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { getPlayersByTeam } from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await auth({
    acceptsToken: ["session_token", "api_key"],
  });

  if (authResult.tokenType === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authResult.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId) {
    return NextResponse.json(
      { error: "teamId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const orgContext = await resolveOrgContext(authResult.userId);
    const data = await getPlayersByTeam(teamId, orgContext);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "/api/cli/players");
  }
}

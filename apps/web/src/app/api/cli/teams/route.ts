import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { getTeams, getTeamsByLeague, createTeam } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/cli/teams[?leagueId=<id>]
 *
 * Returns all teams, or teams filtered by league when ?leagueId is present.
 * Accepts both session cookies and Clerk API keys.
 */
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

  const leagueId = request.nextUrl.searchParams.get("leagueId");

  try {
    const orgContext = await resolveOrgContext(authResult.userId);
    const data = leagueId
      ? await getTeamsByLeague(leagueId, orgContext)
      : await getTeams(orgContext.visibleLeagueIds);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "/api/cli/teams GET");
  }
}

/**
 * POST /api/cli/teams
 *
 * Creates a new team. Body: { name, leagueId, city, stadium }.
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const data = await createTeam(body);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error, "/api/cli/teams POST");
  }
}

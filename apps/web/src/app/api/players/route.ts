import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getPlayers, getPlayersByTeam, createPlayer } from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import { CreatePlayerInputSchema } from "@sports-management/api-contracts";
import { authorizeTeamMutation } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgContext = await resolveOrgContext(userId);
    const teamId = request.nextUrl.searchParams.get("teamId");
    const data = teamId
      ? await getPlayersByTeam(teamId, orgContext)
      : await getPlayers(orgContext.visibleLeagueIds);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "/api/players");
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CreatePlayerInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const authorization = await authorizeTeamMutation(parsed.data.teamId);
  if (!authorization.isAuthorized) {
    return NextResponse.json(
      { error: "You are not authorized to manage this team" },
      { status: 403 },
    );
  }

  try {
    const data = await createPlayer(parsed.data);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error, "/api/players");
  }
}

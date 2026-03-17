import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTeam, getPlayersByTeam, updateTeam } from "@/lib/salesforce-api";
import { UpdateTeamInputSchema } from "@sports-management/api-contracts";
import { authorizeTeamMutation } from "@/lib/authorization";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [team, players] = await Promise.all([
    getTeam(id),
    getPlayersByTeam(id),
  ]);
  return NextResponse.json({ team, players });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const authorization = await authorizeTeamMutation(id);
  if (!authorization.isAuthorized) {
    return NextResponse.json(
      { error: "You are not authorized to manage this team" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = UpdateTeamInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = await updateTeam(id, parsed.data);
  return NextResponse.json(data);
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlayer, updatePlayer, deletePlayer } from "@/lib/salesforce-api";
import { UpdatePlayerInputSchema } from "@sports-management/api-contracts";
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
  const data = await getPlayer(id);
  return NextResponse.json(data);
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
  const existing = await getPlayer(id);

  const authorization = await authorizeTeamMutation(existing.teamId);
  if (!authorization.isAuthorized) {
    return NextResponse.json(
      { error: "You are not authorized to manage this team" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = UpdatePlayerInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = await updatePlayer(id, parsed.data);
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getPlayer(id);

  const authorization = await authorizeTeamMutation(existing.teamId);
  if (!authorization.isAuthorized) {
    return NextResponse.json(
      { error: "You are not authorized to manage this team" },
      { status: 403 },
    );
  }

  await deletePlayer(id);
  return NextResponse.json({ success: true });
}

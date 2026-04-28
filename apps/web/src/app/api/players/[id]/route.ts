import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlayer, updatePlayer, deletePlayer } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { UpdatePlayerInputSchema } from "@sports-management/api-contracts";
import { authorizeTeamMutation } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const orgContext = await resolveOrgContext(userId);
    const data = await getPlayer(id, orgContext);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, `/api/players/${id}`);
  }
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

  try {
    const orgContext = await resolveOrgContext(userId);
    const existing = await getPlayer(id, orgContext);

    const authorization = await authorizeTeamMutation(existing.teamId, userId);
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
  } catch (error) {
    return handleApiError(error, `/api/players/${id}`);
  }
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

  try {
    const orgContext = await resolveOrgContext(userId);
    const existing = await getPlayer(id, orgContext);

    const authorization = await authorizeTeamMutation(existing.teamId, userId);
    if (!authorization.isAuthorized) {
      return NextResponse.json(
        { error: "You are not authorized to manage this team" },
        { status: 403 },
      );
    }

    await deletePlayer(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, `/api/players/${id}`);
  }
}

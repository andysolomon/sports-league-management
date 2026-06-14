import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getTeam,
  getPlayersByTeam,
  updateTeam,
  deleteTeam,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { UpdateTeamInputSchema } from "@sports-management/api-contracts";
import { authorizeTeamMutation, authorizeTeamAdmin } from "@/lib/authorization";
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
    const [team, players] = await Promise.all([
      getTeam(id, orgContext),
      getPlayersByTeam(id, orgContext),
    ]);
    return NextResponse.json({ team, players });
  } catch (error) {
    return handleApiError(error, `/api/teams/${id}`);
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

  const authorization = await authorizeTeamMutation(id, userId);
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

  try {
    const data = await updateTeam(id, parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, `/api/teams/${id}`);
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

  // Removing a whole team is admin-only — coaches manage rosters, not structure.
  const authorization = await authorizeTeamAdmin(id, userId);
  if (!authorization.isAuthorized) {
    return NextResponse.json(
      { error: "You are not authorized to remove this team" },
      { status: 403 },
    );
  }

  try {
    await deleteTeam(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, `/api/teams/${id}`);
  }
}

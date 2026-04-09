import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { updatePlayer } from "@/lib/salesforce-api";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * PUT /api/cli/players/[id]
 *
 * Updates a player. Body: Partial<UpdatePlayerInput>.
 * Used by the TUI's bulk reassign flow to change a player's teamId.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await auth({
    acceptsToken: ["session_token", "api_key"],
  });

  if (authResult.tokenType === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authResult.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = await updatePlayer(id, body);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, `/api/cli/players/${id}`);
  }
}

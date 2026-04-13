import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { readSyncConfig, updateSyncEnabled } from "@/lib/sync/nfl-sync";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const config = await readSyncConfig();
    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error, "/api/import/nfl-sync-config GET");
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { syncEnabled: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.syncEnabled !== "boolean") {
    return NextResponse.json(
      { error: "syncEnabled must be a boolean" },
      { status: 400 },
    );
  }

  try {
    await updateSyncEnabled(body.syncEnabled);
    return NextResponse.json({ syncEnabled: body.syncEnabled });
  } catch (error) {
    return handleApiError(error, "/api/import/nfl-sync-config PUT");
  }
}

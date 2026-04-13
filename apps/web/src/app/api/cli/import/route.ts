import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { LeagueImportSchema } from "@sports-management/api-contracts";
import { bulkImportLeague } from "@/lib/salesforce-api";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/cli/import
 *
 * Validates a nested JSON import payload against LeagueImportSchema,
 * then upserts all entities (league, divisions, teams, players) into Salesforce.
 * Returns an ImportResult with created/updated counts and any entity-level errors.
 *
 * Accepts both session cookies and Clerk API keys.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = LeagueImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await bulkImportLeague(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "/api/cli/import POST");
  }
}

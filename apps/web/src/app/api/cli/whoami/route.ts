import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Tier } from "@/lib/tiers";

export const dynamic = "force-dynamic";

/**
 * GET /api/cli/whoami
 *
 * Smallest possible CLI BFF endpoint. Used by the TUI's `tui login` command
 * to verify that an API key is valid before persisting it to disk, and as a
 * general "am I signed in?" debug ping. Accessible via either an interactive
 * Clerk session cookie or a Clerk API key in `Authorization: Bearer ...`.
 */
export async function GET() {
  // `auth()` defaults to accepting only session tokens. For CLI routes we
  // need to opt into API keys explicitly — the middleware already gates
  // this route to `session_token` or `api_key`, but the route handler's
  // own `auth()` call has its own default that must match.
  //
  // Passing `acceptsToken` widens the return type to a union that includes
  // `InvalidTokenAuthObject` (no/bad token) and org-scoped machine objects
  // where `userId` is null. Narrow via `tokenType` before reading `userId`
  // so TypeScript can prove the field exists.
  const authResult = await auth({
    acceptsToken: ["session_token", "api_key"],
  });

  if (authResult.tokenType === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authResult.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId, tokenType } = authResult;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const tier = (user.publicMetadata?.tier as Tier | undefined) ?? "free";

  return NextResponse.json({
    userId,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    tier,
    authMethod: tokenType,
  });
}

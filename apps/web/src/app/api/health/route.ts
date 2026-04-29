import { NextResponse } from "next/server";
import { getPublicLeagues } from "@/lib/data-api";

export async function GET() {
  const checks: Record<string, unknown> = {};

  checks.NEXT_PUBLIC_CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL
    ? "set"
    : "MISSING";

  try {
    // Cheap Convex round-trip — proves the deployment is reachable and the
    // sports module loaded without throwing. listPublicLeagues is a small
    // index-backed scan with a stable shape.
    const leagues = await getPublicLeagues();
    checks.convex = `ok (public leagues: ${leagues.length})`;
  } catch (err) {
    checks.convex = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json(checks, { status: 503 });
  }

  return NextResponse.json(checks);
}

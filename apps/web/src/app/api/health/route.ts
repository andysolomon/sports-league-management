import { NextResponse } from "next/server";
import { getHealthSummary } from "@/lib/data-api";

function clerkKeyType(value: string | undefined): string {
  if (!value) return "missing";
  if (value.startsWith("pk_test_") || value.startsWith("sk_test_")) return "test";
  if (value.startsWith("pk_live_") || value.startsWith("sk_live_")) return "live";
  return "unknown";
}

function decodeClerkFrontendApi(publishableKey: string | undefined): string {
  if (!publishableKey) return "missing";

  const encoded = publishableKey.replace(/^pk_(test|live)_/, "");
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    return Buffer.from(padded, "base64").toString("utf8").replace(/\$/g, "");
  } catch {
    return "unknown";
  }
}

function urlHost(value: string | undefined): string {
  if (!value) return "MISSING";

  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function cleaned(value: string | undefined): string {
  return value?.trim() || "MISSING";
}

export async function GET() {
  const checks: Record<string, unknown> = {};

  checks.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? "set"
    : "MISSING";
  checks.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ? "set" : "MISSING";
  checks.NEXT_PUBLIC_CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL
    ? "set"
    : "MISSING";
  checks.CONVEX_ADMIN_KEY = process.env.CONVEX_ADMIN_KEY ? "set" : "MISSING";
  checks.envIdentity = {
    clerkPublishableKeyType: clerkKeyType(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    ),
    clerkPublishableFrontendApi: decodeClerkFrontendApi(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    ),
    clerkSecretKeyType: clerkKeyType(process.env.CLERK_SECRET_KEY),
    appUrlHost: urlHost(process.env.NEXT_PUBLIC_APP_URL),
    convexHost: urlHost(process.env.NEXT_PUBLIC_CONVEX_URL),
    legacySalesforceUsername: cleaned(process.env.SF_USERNAME),
  };

  try {
    const summary = await getHealthSummary();
    checks.convex = `connected to ${urlHost(process.env.NEXT_PUBLIC_CONVEX_URL)}`;
    checks.data = `ok (${summary.leagues} leagues, ${summary.teams} teams, ${summary.players} players)`;
  } catch (err) {
    checks.convex = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    checks.data = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json(checks, { status: 503 });
  }

  return NextResponse.json(checks);
}

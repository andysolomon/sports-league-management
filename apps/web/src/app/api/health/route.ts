import { NextResponse } from "next/server";
import { getSalesforceConnection } from "@/lib/salesforce";
import { getLeagues } from "@/lib/salesforce-api";

export async function GET() {
  const checks: Record<string, unknown> = {};

  checks.SF_LOGIN_URL = process.env.SF_LOGIN_URL ? "set" : "MISSING";
  checks.SF_CLIENT_ID = process.env.SF_CLIENT_ID ? "set" : "MISSING";
  checks.SF_USERNAME = process.env.SF_USERNAME ? "set" : "MISSING";
  checks.SF_PRIVATE_KEY = process.env.SF_PRIVATE_KEY ? "set" : "MISSING";

  try {
    const conn = await getSalesforceConnection();
    checks.salesforce = `connected to ${conn.instanceUrl}`;
  } catch (err) {
    checks.salesforce = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json(checks, { status: 503 });
  }

  try {
    const leagues = await getLeagues();
    checks.data = `ok (${leagues.length} leagues)`;
  } catch (err) {
    checks.data = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json(checks, { status: 503 });
  }

  return NextResponse.json(checks);
}

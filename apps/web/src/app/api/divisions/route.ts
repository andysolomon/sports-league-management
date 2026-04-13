import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDivisions } from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgContext = await resolveOrgContext(userId);
    const data = await getDivisions(orgContext.visibleLeagueIds);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "/api/divisions");
  }
}

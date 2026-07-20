import { auth } from "@clerk/nextjs/server";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getLeague } from "@/lib/data-api";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import { leagueSettingsHref } from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

/**
 * Legacy league manage URL (WSM-000254). League Settings now live at
 * `/dashboard/settings/league` for the Active League (issue #576, ASR-8).
 * This route stays access-validated so probing arbitrary league ids still
 * yields a non-disclosing 404 (ASR-11); authorized admins get the Active
 * League synced to this league before the permanent redirect.
 */
export default async function LeagueManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(id, orgContext).catch(() => null);
  if (!league) notFound();

  if (!league.orgId) notFound();

  try {
    await requireOrgAdmin(league.orgId, userId);
  } catch {
    notFound();
  }
  await syncActiveLeagueForResource(league.id);

  permanentRedirect(leagueSettingsHref());
}

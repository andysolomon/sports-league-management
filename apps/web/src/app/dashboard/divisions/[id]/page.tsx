import { auth } from "@clerk/nextjs/server";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getDivision } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";
import { divisionsViewHref } from "../../teams/teams-home-navigation";

/**
 * Legacy Division detail. Validate resource access before redirecting so an
 * inaccessible, invalid, or cross-league Division remains non-disclosing.
 */
export default async function DivisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);
  const division = await getDivision(id, orgContext).catch(() => null);
  if (!division) notFound();

  await syncActiveLeagueForResource(division.leagueId);
  permanentRedirect(divisionsViewHref(division.id));
}

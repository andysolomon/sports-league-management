import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLeague } from "@/lib/data-api";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import RequestsTable from "./requests-table";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import { leagueHomeHref } from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(id, orgContext);

  if (!league.orgId) {
    redirect(`/dashboard/leagues/${id}`);
  }

  try {
    await requireOrgAdmin(league.orgId, userId);
  } catch {
    redirect(`/dashboard/leagues/${id}`);
  }
  await syncActiveLeagueForResource(league.id);

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="league"
        name={league.name}
        href={leagueHomeHref(id)}
        subtitle="Join requests"
      />

      <RequestsTable orgId={league.orgId} />
    </div>
  );
}

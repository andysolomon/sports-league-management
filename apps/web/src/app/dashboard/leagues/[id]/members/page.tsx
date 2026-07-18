import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLeague } from "@/lib/data-api";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import MemberList from "./member-list";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import { leagueHomeHref } from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function MembersPage({
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

  // Verify admin access
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
        subtitle="Members & invites"
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Members — {league.name}
        </h2>
        <Link
          href="/dashboard/roles"
          className="text-sm text-primary hover:underline"
        >
          Roles &amp; permissions →
        </Link>
      </div>

      <MemberList orgId={league.orgId} />
    </div>
  );
}

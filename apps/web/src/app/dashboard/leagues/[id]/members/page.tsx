import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLeague } from "@/lib/salesforce-api";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import MemberList from "./member-list";

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

  return (
    <div>
      <Link
        href={`/dashboard/leagues/${id}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to {league.name}
      </Link>

      <h2 className="mb-6 text-lg font-semibold text-foreground">
        Members — {league.name}
      </h2>

      <MemberList orgId={league.orgId} />
    </div>
  );
}

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTeam, getPlayersByTeam } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { canManageTeam } from "@/lib/authorization";
import TeamManagement from "./team-management";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);

  const [team, players, canManage] = await Promise.all([
    getTeam(id, orgContext),
    getPlayersByTeam(id, orgContext),
    canManageTeam(id, userId),
  ]);

  return (
    <div>
      <Link
        href="/dashboard/teams"
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Teams
      </Link>

      <TeamManagement team={team} players={players} canManage={canManage} />
    </div>
  );
}

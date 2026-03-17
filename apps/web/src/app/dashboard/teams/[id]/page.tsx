import Link from "next/link";
import { getTeam, getPlayersByTeam } from "@/lib/salesforce-api";
import { canManageTeam } from "@/lib/authorization";
import TeamManagement from "./team-management";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [team, players, canManage] = await Promise.all([
    getTeam(id),
    getPlayersByTeam(id),
    canManageTeam(id),
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

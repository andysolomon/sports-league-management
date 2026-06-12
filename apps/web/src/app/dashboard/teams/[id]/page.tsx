import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getTeam,
  getPlayersByTeam,
  getSeasons,
  getTeamAttributeSnapshots,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { canManageTeam } from "@/lib/authorization";
import { playerAttributesV1 } from "@/lib/flags";
import type { PlayerSnapshot } from "@/lib/attributes/headline-columns";
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

  // WSM-000090: attribute snapshots feed the Madden stat columns.
  // Phase 2-gated; resolved against the league's active season, same
  // rule as the depth-chart page. Failure here must never take down
  // the roster — columns simply don't render.
  let snapshots: ReadonlyMap<string, PlayerSnapshot> = new Map();
  if (await playerAttributesV1()) {
    const seasons = await getSeasons([team.leagueId]).catch(() => []);
    const activeSeason =
      seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
    if (activeSeason) {
      snapshots = await getTeamAttributeSnapshots(
        id,
        activeSeason.id,
        orgContext,
      ).catch(() => new Map());
    }
  }

  return (
    <div>
      <Link
        href="/dashboard/teams"
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Teams
      </Link>

      <TeamManagement
        team={team}
        players={players}
        canManage={canManage}
        attributeSnapshots={Object.fromEntries(snapshots)}
      />
    </div>
  );
}

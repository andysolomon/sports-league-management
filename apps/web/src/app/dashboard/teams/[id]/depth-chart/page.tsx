import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { depthChartV1 } from "@/lib/flags";
import {
  getTeam,
  getPlayersByTeam,
  getSeasons,
  getDepthChartByTeamSeason,
  getLeagueOrgId,
} from "@/lib/data-api";
import { getUserRoleInOrg } from "@/lib/org-context";
import DepthChartBoard from "@/components/depth-chart/DepthChartBoard";

export default async function DepthChartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await depthChartV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: teamId } = await params;

  const team = await getTeam(teamId, {
    userId,
    orgIds: [],
    visibleLeagueIds: [],
    subscribedLeagueIds: [],
  }).catch(() => null);
  if (!team) notFound();

  const orgId = await getLeagueOrgId(team.leagueId);
  if (!orgId) notFound();

  const role = await getUserRoleInOrg(orgId, userId);
  if (!role) notFound();
  const isAdmin = role === "org:admin";

  const seasons = await getSeasons([team.leagueId]);
  const activeSeason =
    seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
  if (!activeSeason) {
    return (
      <div>
        <Link
          href={`/dashboard/teams/${teamId}`}
          className="mb-4 inline-block text-sm text-primary hover:underline"
        >
          &larr; Back to Team
        </Link>
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No season exists for this league. Create a season before editing the
          depth chart.
        </div>
      </div>
    );
  }

  const [players, entries] = await Promise.all([
    getPlayersByTeam(teamId, {
      userId,
      orgIds: [orgId],
      visibleLeagueIds: [team.leagueId],
      subscribedLeagueIds: [],
    }),
    getDepthChartByTeamSeason(teamId, activeSeason.id),
  ]);

  return (
    <div>
      <Link
        href={`/dashboard/teams/${teamId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Team
      </Link>
      <DepthChartBoard
        teamId={teamId}
        teamName={team.name}
        leagueId={team.leagueId}
        season={activeSeason}
        players={players}
        entries={entries}
        isAdmin={isAdmin}
      />
    </div>
  );
}

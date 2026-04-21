import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { rosterSnapshotsV1 } from "@/lib/flags";
import {
  getTeam,
  getPlayersByTeam,
  getSeasons,
  getRosterBySeasonTeam,
  getTeamRosterLimitStatus,
} from "@/lib/data-api";
import { getLeagueOrgId, getUserRoleInOrg } from "@/lib/org-context";
import RosterBoard from "@/components/roster/RosterBoard";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await rosterSnapshotsV1();
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
          No season exists for this league. Create a season before managing the
          roster.
        </div>
      </div>
    );
  }

  const [players, assignments, limitStatus] = await Promise.all([
    getPlayersByTeam(teamId, {
      userId,
      orgIds: [orgId],
      visibleLeagueIds: [team.leagueId],
      subscribedLeagueIds: [],
    }),
    getRosterBySeasonTeam(activeSeason.id, teamId),
    getTeamRosterLimitStatus(activeSeason.id, teamId),
  ]);

  return (
    <div>
      <Link
        href={`/dashboard/teams/${teamId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Team
      </Link>
      <RosterBoard
        team={team}
        season={activeSeason}
        players={players}
        assignments={assignments}
        limitStatus={limitStatus}
      />
    </div>
  );
}

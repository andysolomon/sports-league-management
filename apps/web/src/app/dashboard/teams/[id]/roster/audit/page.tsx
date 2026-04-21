import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { rosterSnapshotsV1 } from "@/lib/flags";
import {
  getTeam,
  getPlayersByTeam,
  getSeasons,
  getRosterAssignmentHistory,
} from "@/lib/data-api";
import { getLeagueOrgId, getUserRoleInOrg } from "@/lib/org-context";
import RosterAuditTimeline from "@/components/roster/RosterAuditTimeline";

export default async function RosterAuditPage({
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
          href={`/dashboard/teams/${teamId}/roster`}
          className="mb-4 inline-block text-sm text-primary hover:underline"
        >
          &larr; Back to Roster
        </Link>
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No season exists for this league.
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
    getRosterAssignmentHistory({
      teamId,
      seasonId: activeSeason.id,
      limit: 200,
    }),
  ]);

  return (
    <div>
      <Link
        href={`/dashboard/teams/${teamId}/roster`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Roster
      </Link>
      <header className="mb-4">
        <h2 className="text-2xl font-bold text-foreground">
          {team.name} — Roster Audit Log
        </h2>
        <p className="text-sm text-muted-foreground">
          Season: {activeSeason.name}
        </p>
      </header>
      <RosterAuditTimeline entries={entries} players={players} />
    </div>
  );
}

import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { depthChartV1, rosterSnapshotsV1 } from "@/lib/flags";
import {
  getTeam,
  getTeamLeagueId,
  getLeagueOrgId,
  getPlayersByTeam,
  getSeasons,
  getRosterAssignmentHistory,
} from "@/lib/data-api";
import { getUserRoleInOrg } from "@/lib/org-context";
import RosterAuditTimeline from "@/components/roster/RosterAuditTimeline";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildTeamSiblingLinks,
  teamHomeHref,
  teamSubpageHref,
} from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

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

  const leagueId = await getTeamLeagueId(teamId).catch(() => null);
  if (!leagueId) notFound();
  const team = await getTeam(teamId, {
    userId,
    orgIds: [],
    visibleLeagueIds: [leagueId],
    subscribedLeagueIds: [],
    subscriptionTeamScopes: {},
  }).catch(() => null);
  if (!team) notFound();

  const orgId = await getLeagueOrgId(team.leagueId);
  if (!orgId) notFound();

  const role = await getUserRoleInOrg(orgId, userId);
  if (!role) notFound();
  await syncActiveLeagueForResource(team.leagueId);

  const seasons = await getSeasons([team.leagueId]);
  const activeSeason =
    seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
  if (!activeSeason) {
    return (
      <div className="space-y-4">
        <ResourceHeader
          kind="team"
          name={team.name}
          href={teamHomeHref(teamId)}
          subtitle="Roster · Audit log"
          siblings={[
            { label: "Roster", href: teamSubpageHref(teamId, "roster") },
          ]}
        />
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
      subscriptionTeamScopes: {},
    }),
    getRosterAssignmentHistory({
      teamId,
      seasonId: activeSeason.id,
      limit: 200,
    }),
  ]);

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="team"
        name={team.name}
        href={teamHomeHref(teamId)}
        subtitle="Roster · Audit log"
        context={`Season: ${activeSeason.name}`}
        siblings={buildTeamSiblingLinks({
          teamId,
          rosterEnabled: enabled,
          depthChartEnabled: await depthChartV1(),
        })}
      />
      <h2 className="text-2xl font-bold text-foreground">
        {team.name} — Roster Audit Log
      </h2>
      <RosterAuditTimeline entries={entries} players={players} />
    </div>
  );
}

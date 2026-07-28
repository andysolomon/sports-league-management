import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { depthChartV1, rosterSnapshotsV1 } from "@/lib/flags";
import {
  getTeam,
  getTeamLeagueId,
  getPlayersByTeam,
  getSeasons,
  listTeamInjuries,
  getDepthChartByTeamSeason,
  getLeagueOrgId,
} from "@/lib/data-api";
import { resolveOrgRole } from "@/lib/org-context";
import { canManageRoster, canManageOrgSettings } from "@/lib/permissions";
import DepthChartBoard from "@/components/depth-chart/DepthChartBoard";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildTeamSiblingLinks,
  teamHomeHref,
} from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

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

  // Resolve leagueId first so the access check inside getTeam has the
  // correct visibleLeagueIds (an empty list made getTeam throw for every
  // team, 404ing the whole route — #435); real auth runs against the
  // league's Clerk org a few lines below via getLeagueOrgId + resolveOrgRole.
  // Matches the roster + audit pages.
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

  const role = await resolveOrgRole(orgId, userId);
  if (!role) notFound();
  await syncActiveLeagueForResource(team.leagueId);
  // Coaches can edit the depth chart; only admins toggle the season lock.
  const canEdit = canManageRoster(role);
  const isAdmin = canManageOrgSettings(role);

  const seasons = await getSeasons([team.leagueId]);
  const activeSeason =
    seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
  if (!activeSeason) {
    return (
      <div className="space-y-4">
        <ResourceHeader
          kind="team"
          title="Depth chart"
          homeHref={teamHomeHref(teamId)}
          context={team.name}
          siblings={buildTeamSiblingLinks({
            teamId,
            rosterEnabled: await rosterSnapshotsV1(),
            depthChartEnabled: enabled,
          })}
        />
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No season exists for this league. Create a season before editing the
          depth chart.
        </div>
      </div>
    );
  }

  /*
   * Injured players are marked ON the depth chart (A4), because that is where
   * a coach decides who starts — a separate report is easy to miss.
   */
  const injuries = await listTeamInjuries({
    teamId: teamId,
    seasonId: activeSeason.id,
  }).catch(() => []);
  const outPlayers = new Map(
    injuries
      .filter((injury) => injury.status === "out" && injury.gamesOut > 0)
      .map((injury) => [injury.playerId, injury.gamesOut] as const),
  );

  const [players, entries] = await Promise.all([
    getPlayersByTeam(teamId, {
      userId,
      orgIds: [orgId],
      visibleLeagueIds: [team.leagueId],
      subscribedLeagueIds: [],
      subscriptionTeamScopes: {},
    }),
    getDepthChartByTeamSeason(teamId, activeSeason.id),
  ]);

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="team"
        title="Depth chart"
        homeHref={teamHomeHref(teamId)}
        context={team.name}
        siblings={buildTeamSiblingLinks({
          teamId,
          rosterEnabled: await rosterSnapshotsV1(),
          depthChartEnabled: enabled,
        })}
      />
      <DepthChartBoard
        outPlayers={outPlayers}
        teamId={teamId}
        teamName={team.name}
        leagueId={team.leagueId}
        season={activeSeason}
        players={players}
        entries={entries}
        isAdmin={isAdmin}
        canEdit={canEdit}
      />
    </div>
  );
}

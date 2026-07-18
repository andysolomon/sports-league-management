import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  getTeam,
  getPlayersByTeam,
  getTeamAttributeSnapshots,
  getTeamMaddenOveralls,
  getLeagueClaimable,
  getSeasons,
  listFixturesBySeason,
} from "@/lib/data-api";
import { isSeasonStarted } from "@/lib/season-started";
import { resolveOrgContext } from "@/lib/org-context";
import { canManageTeam, canAdministerTeam } from "@/lib/authorization";
import {
  depthChartV1,
  playerAttributesV1,
  rosterSnapshotsV1,
  syntheticRostersV1,
} from "@/lib/flags";
import type { PlayerSnapshot } from "@/lib/attributes/headline-columns";
import TeamManagement from "./team-management";
import { ClaimTeamButton } from "./claim-team-button";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildTeamSiblingLinks,
  teamHomeHref,
} from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);

  // Resolve the team first, guarded: a bad/legacy team id (e.g. a stale external
  // id leaking in via an old link) fails Convex's `v.id("teams")`
  // validation and throws ArgumentValidationError; an unknown-but-valid id
  // resolves to null. Either way the route must 404, not 500 (WSM-000190).
  // Matches the players/[id] + divisions/[id] guard pattern.
  const team = await getTeam(id, orgContext).catch(() => null);
  if (!team) notFound();
  await syncActiveLeagueForResource(team.leagueId);

  // canManage = admin or coach (roster/players/edit); canDelete = admin only
  // (removing the whole team). WSM-000121 intra-org roles. Safe to run now that
  // the team id is known-valid.
  const [players, canManage, canDelete, rosterEnabled, depthChartEnabled] =
    await Promise.all([
      getPlayersByTeam(id, orgContext),
      canManageTeam(id, userId),
      canAdministerTeam(id, userId),
      rosterSnapshotsV1(),
      depthChartV1(),
    ]);

  // Fork affordance (WSM-000115): a reference team in a forkable league can be
  // copied into the user's private workspace (editable). Offered whenever the
  // user can't already manage this (read-only reference) team and the league is
  // forkable — no org prerequisite (the fork creates one). Degrades to no offer.
  let offerFork = false;
  if (!canManage) {
    offerFork = await getLeagueClaimable(team.leagueId).catch(() => false);
  }

  // WSM-000173: synthetic-roster generation — managers only, behind the flag.
  const canGenerateRoster = canManage && (await syntheticRostersV1());

  const seasons = await getSeasons([team.leagueId]).catch(() => []);
  const activeSeason =
    seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
  const seasonStarted = activeSeason
    ? isSeasonStarted(
        activeSeason,
        await listFixturesBySeason(activeSeason.id).catch(() => []),
      )
    : false;

  // WSM-000090: attribute snapshots feed the SPRT stat columns. Phase 2-gated;
  // the season is resolved server-side — including workspace forks, which read
  // their source league's current season (WSM-000122). Failure here must never
  // take down the roster — columns simply don't render.
  let snapshots: ReadonlyMap<string, PlayerSnapshot> = new Map();
  let maddenOveralls: ReadonlyMap<string, number> = new Map();
  if (await playerAttributesV1()) {
    snapshots = await getTeamAttributeSnapshots(id, orgContext).catch(
      () => new Map(),
    );
    // WSM-000095: Madden overall per player, shown beside SPRT. Season-agnostic.
    maddenOveralls = await getTeamMaddenOveralls(id, orgContext).catch(
      () => new Map(),
    );
  }

  const siblingLinks = buildTeamSiblingLinks({
    teamId: id,
    rosterEnabled,
    depthChartEnabled,
  });

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="team"
        name={team.name}
        href={teamHomeHref(id)}
        subtitle="Team Home"
        siblings={siblingLinks}
      />

      {offerFork && (
        <div className="mb-4 rounded-md border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">Coach here?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add {team.name} to your teams — you&rsquo;ll get your own private
            copy to manage (roster, depth chart, stats), separate from everyone
            else. We&rsquo;ll set up your organization if you don&rsquo;t have
            one yet.
          </p>
          <div className="mt-3">
            <ClaimTeamButton teamId={team.id} teamName={team.name} />
          </div>
        </div>
      )}

      <TeamManagement
        team={team}
        players={players}
        canManage={canManage}
        canDelete={canDelete}
        canGenerateRoster={canGenerateRoster}
        seasonStarted={seasonStarted}
        attributeSnapshots={Object.fromEntries(snapshots)}
        maddenOveralls={Object.fromEntries(maddenOveralls)}
      />
    </div>
  );
}

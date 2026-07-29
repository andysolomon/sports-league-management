import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { dynastyOffseasonV2 } from "@/lib/flags";
import {
  getDraft,
  getLeague,
  getOffseason,
  getSeason,
  getTeamsByLeague,
  listProspects,
  listTransfers,
} from "@/lib/data-api";
import { canManageTeam } from "@/lib/authorization";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import { seasonHomeHref } from "@/components/workspace/resource-navigation";
import { OffseasonPhaseControls } from "@/components/offseason/OffseasonPhaseControls";
import { ScoutingPanel } from "@/components/offseason/ScoutingPanel";
import { TransferPanel } from "@/components/offseason/TransferPanel";
import { resolveOffseasonState } from "@/lib/dynasty/offseason-phases";
import { DYNASTY_CONFIG_DEFAULTS } from "@/lib/dynasty-config";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

/*
 * Offseason Hub (Dynasty Mode B1).
 *
 * A dedicated surface for the phase machine, separate from the Offseason card
 * on Season Home. Season Home shows an admin where the offseason IS; this page
 * is where they move it, and where B2–B6 hang the per-phase panels.
 */
export default async function SeasonOffseasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await dynastyOffseasonV2();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: seasonId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const season = await getSeason(seasonId, orgContext).catch(() => null);
  if (!season) notFound();

  /*
   * An offseason prepares a season that has not started. On an active or
   * completed season there is nothing here to do, and showing the controls
   * would imply a roster window that results have already closed.
   */
  if (season.status !== "upcoming") notFound();

  const league = await getLeague(season.leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const [offseason, draft, teams, prospects, transfers] = await Promise.all([
    getOffseason(season.id).catch(() => null),
    getDraft(season.id).catch(() => null),
    getTeamsByLeague(league.id, orgContext).catch(() => []),
    listProspects(season.id).catch(() => []),
    listTransfers(season.id).catch(() => []),
  ]);

  const role = league.orgId ? await resolveOrgRole(league.orgId, userId) : null;
  const isAdmin = canManageOrgSettings(role);

  /*
   * Which team this viewer recruits FOR. An admin acts for the whole league and
   * needs a team to attribute a signing to, so they act for the first one until
   * multi-coach (Wave 5) gives every user their own; a coach acts for the team
   * they manage and for no other. This is the page-level half of the per-team
   * authorization the mutation enforces — it decides what to offer, and the
   * action decides what is allowed.
   */
  const managed: { id: string; name: string }[] = [];
  for (const team of teams) {
    if (await canManageTeam(team.id, userId)) managed.push(team);
  }
  const actingTeam = managed[0] ?? (isAdmin ? (teams[0] ?? null) : null);

  const draftStatus = !draft
    ? ("none" as const)
    : draft.status === "complete"
      ? ("complete" as const)
      : ("active" as const);
  const state = resolveOffseasonState(offseason, { draftStatus });

  return (
    <div className="mx-auto max-w-[960px] space-y-4">
      <ResourceHeader
        kind="season"
        title="Offseason"
        homeHref={seasonHomeHref(season.id)}
        context={`${season.name} · ${league.name}`}
      />

      <Card data-testid="offseason-hub-page">
        <CardContent className="space-y-6 p-5">
          <OffseasonPhaseControls
            leagueId={league.id}
            seasonId={season.id}
            state={state}
            draftStatus={draftStatus}
            isAdmin={isAdmin}
            teamCount={teams.length}
          />

          <ScoutingPanel
            seasonId={season.id}
            prospects={prospects}
            teams={teams}
            actingTeam={actingTeam}
            canRecruit={actingTeam !== null}
            scoutingPointsSpent={offseason?.scoutingPointsSpent ?? 0}
            scoutingPointsTotal={
              offseason?.scoutingPointsTotal ??
              DYNASTY_CONFIG_DEFAULTS.scoutingPointsPerOffseason
            }
          />

          <TransferPanel
            leagueId={league.id}
            seasonId={season.id}
            transfers={transfers}
            actingTeam={actingTeam}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}

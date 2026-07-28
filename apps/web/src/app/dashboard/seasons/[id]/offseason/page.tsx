import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { dynastyOffseasonV2 } from "@/lib/flags";
import {
  getDraft,
  getLeague,
  getOffseason,
  getSeason,
  getTeamsByLeague,
} from "@/lib/data-api";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import { seasonHomeHref } from "@/components/workspace/resource-navigation";
import { OffseasonPhaseControls } from "@/components/offseason/OffseasonPhaseControls";
import { resolveOffseasonState } from "@/lib/dynasty/offseason-phases";
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

  const [offseason, draft, teams] = await Promise.all([
    getOffseason(season.id).catch(() => null),
    getDraft(season.id).catch(() => null),
    getTeamsByLeague(league.id, orgContext).catch(() => []),
  ]);

  const role = league.orgId ? await resolveOrgRole(league.orgId, userId) : null;
  const isAdmin = canManageOrgSettings(role);

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
        </CardContent>
      </Card>
    </div>
  );
}

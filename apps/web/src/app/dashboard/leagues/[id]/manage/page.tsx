import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  getLeague,
  getLeagueVisibility,
  getLeagueClaimable,
  getSeasons,
  listFixturesBySeason,
  getPlayers,
  getTeamsByLeague,
} from "@/lib/data-api";
import { isSeasonStarted } from "@/lib/season-started";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";
import { BackLink } from "@/components/workspace/BackLink";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import InviteForm from "../invite-form";
import InvitationList from "../invitation-list";
import InviteLinkSection from "../invite-link-section";
import LeaguePublicToggle from "../league-public-toggle";
import LeagueClaimableToggle from "../league-claimable-toggle";
import {
  RenameLeagueForm,
  DeleteLeagueButton,
  AddTeamForm,
} from "../../leagues-actions";
import { syntheticRostersV1 } from "@/lib/flags";
import { SyntheticRosterButton } from "@/components/roster/SyntheticRosterButton";
import { UndersizedRosterPanel } from "@/components/roster/UndersizedRosterPanel";
import {
  activeRosterCountByTeam,
  buildLeagueRosterDeficitProjection,
} from "@/lib/roster-deficit";
import { DEFAULT_TARGET_ROSTER_SIZE } from "@/lib/offseason-activate";

/**
 * League manage surface (WSM-000254): admin settings relocated from the league
 * info destination. Polish is scoped to WSM-000251 — preserve existing controls.
 */
export default async function LeagueManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(id, orgContext).catch(() => null);
  if (!league) notFound();

  if (!league.orgId) notFound();

  try {
    await requireOrgAdmin(league.orgId, userId);
  } catch {
    notFound();
  }

  const visibility = await getLeagueVisibility(id);
  const claimable = await getLeagueClaimable(id);
  const canGenerateRosters = await syntheticRostersV1();

  const seasons = await getSeasons([id]).catch(() => []);
  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const [fixtures, leaguePlayers, teams] = await Promise.all([
    activeSeason
      ? listFixturesBySeason(activeSeason.id).catch(() => [])
      : Promise.resolve([]),
    getPlayers([id]).catch(() => []),
    getTeamsByLeague(id, orgContext).catch(() => []),
  ]);
  const seasonStarted = activeSeason
    ? isSeasonStarted(activeSeason, fixtures)
    : false;
  const rosterDeficit = buildLeagueRosterDeficitProjection(
    teams,
    activeRosterCountByTeam(leaguePlayers),
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leagues", href: "/dashboard/leagues" },
          { label: league.name, href: `/dashboard/leagues/${id}` },
          { label: "Manage" },
        ]}
      />
      <BackLink href={`/dashboard/leagues/${id}`} label="Back to League" />
      <WorkspaceHeader title={league.name} sub="Manage league settings" />

      <Card data-testid="league-manage-settings">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-1">
              <RenameLeagueForm leagueId={id} currentName={league.name} />
              <DeleteLeagueButton leagueId={id} leagueName={league.name} />
            </div>
            <InviteForm orgId={league.orgId} />
            <InvitationList orgId={league.orgId} />
            <InviteLinkSection leagueId={id} />
            <LeaguePublicToggle
              leagueId={id}
              initialIsPublic={visibility?.isPublic ?? false}
            />
            <LeagueClaimableToggle
              leagueId={id}
              initialClaimable={claimable}
              isPublic={visibility?.isPublic ?? false}
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <div className="min-w-0">
                <p className="text-label-14 text-foreground">Teams</p>
                <p className="text-caption-12 text-text-muted">
                  Add a team to this league.
                </p>
              </div>
              <AddTeamForm leagueId={id} />
            </div>
            {canGenerateRosters ? (
              <div className="space-y-3 border-t border-border pt-4">
                <UndersizedRosterPanel
                  leagueId={id}
                  target={rosterDeficit.target}
                  undersizedTeams={rosterDeficit.teams}
                  canAutoFill={!seasonStarted}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-label-14 text-foreground">
                      Synthetic rosters
                    </p>
                    <p className="text-caption-12 text-text-muted">
                      {seasonStarted
                        ? "Season has started — roster and ratings generation is locked."
                        : "Fill every team in this league with fake test players (~48 each) for demos. Not real people."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SyntheticRosterButton
                      kind="league"
                      id={id}
                      seasonStarted={seasonStarted}
                    />
                    <SyntheticRosterButton
                      kind="league"
                      id={id}
                      action="attributes"
                      seasonStarted={seasonStarted}
                    />
                    <SyntheticRosterButton
                      kind="league"
                      id={id}
                      action="clear"
                    />
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link
                href={`/dashboard/leagues/${id}/members`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Manage Members &rarr;
              </Link>
              <Link
                href={`/dashboard/leagues/${id}/requests`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Join Requests &rarr;
              </Link>
              <Link
                href={`/dashboard/leagues/${id}/schedule`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Schedule &rarr;
              </Link>
              <Link
                href={`/dashboard/leagues/${id}/standings`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Standings &rarr;
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

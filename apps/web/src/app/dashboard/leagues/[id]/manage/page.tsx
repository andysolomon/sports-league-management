import type { ReactNode } from "react";
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
 * League manage surface (WSM-000254), recomposed into the prototype's
 * "Manage league" settings-row pattern (WSM-000251): one Settings card of
 * label + description + control rows, ending in a Danger zone. Every control
 * predates the polish and keeps its behavior.
 */
function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="text-label-14 text-foreground">{title}</p>
        <p className="text-caption-12 text-text-muted">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

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
      <WorkspaceHeader
        title="Manage league"
        sub="Settings, members, and roster tools."
      />

      <Card data-testid="league-manage-settings">
        <CardContent className="pt-6">
          <h2 className="text-lg font-bold tracking-[-0.3px] text-foreground">
            Settings
          </h2>
          <div className="divide-y divide-border">
            <SettingsRow title="League name" description="Rename this league.">
              <RenameLeagueForm leagueId={id} currentName={league.name} />
            </SettingsRow>

            <div className="space-y-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-label-14 text-foreground">
                    Members &amp; invites
                  </p>
                  <p className="text-caption-12 text-text-muted">
                    Invite operators and coaches.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
                </div>
              </div>
              <InviteForm orgId={league.orgId} />
              <InvitationList orgId={league.orgId} />
              <InviteLinkSection leagueId={id} />
            </div>

            <div className="py-4">
              <LeaguePublicToggle
                leagueId={id}
                initialIsPublic={visibility?.isPublic ?? false}
              />
            </div>

            <div className="py-4">
              <LeagueClaimableToggle
                leagueId={id}
                initialClaimable={claimable}
                isPublic={visibility?.isPublic ?? false}
              />
            </div>

            <SettingsRow title="Teams" description="Add a team to this league.">
              <AddTeamForm leagueId={id} />
            </SettingsRow>

            {canGenerateRosters ? (
              <div className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label-14 text-foreground">
                      Synthetic rosters
                    </p>
                    <p className="text-caption-12 text-text-muted">
                      {seasonStarted
                        ? "Season has started — roster and ratings generation is locked."
                        : "Fill every team with ~48 fake players for demos."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                <UndersizedRosterPanel
                  leagueId={id}
                  target={rosterDeficit.target}
                  undersizedTeams={rosterDeficit.teams}
                  canAutoFill={!seasonStarted}
                />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-x-4 gap-y-2 py-4">
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

            <SettingsRow
              title="Danger zone"
              description="Delete this league and all its data."
            >
              <DeleteLeagueButton
                leagueId={id}
                leagueName={league.name}
                appearance="labeled"
              />
            </SettingsRow>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getLeague,
  getLeagueVisibility,
  getLeagueClaimable,
  getSeasons,
  listFixturesBySeason,
  getPlayoffBracket,
  getPlayers,
  getTeamsByLeague,
} from "@/lib/data-api";
import { summarizeClassDistribution } from "@/lib/class-year";
import {
  dynastySeasonState,
  evaluateStartNextSeason,
  seasonDecidedContext,
} from "@/lib/dynasty-panel";
import { DynastyPanel } from "@/components/dynasty/DynastyPanel";
import { isSeasonStarted } from "@/lib/season-started";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import InviteForm from "./invite-form";
import InvitationList from "./invitation-list";
import InviteLinkSection from "./invite-link-section";
import LeaguePublicToggle from "./league-public-toggle";
import LeagueClaimableToggle from "./league-claimable-toggle";
import {
  RenameLeagueForm,
  DeleteLeagueButton,
  AddTeamForm,
} from "../leagues-actions";
import { syntheticRostersV1 } from "@/lib/flags";
import { SyntheticRosterButton } from "@/components/roster/SyntheticRosterButton";

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(id, orgContext);
  const visibility = await getLeagueVisibility(id);
  const claimable = await getLeagueClaimable(id);

  // Check if user is admin of this league's org
  let isAdmin = false;
  if (league.orgId) {
    try {
      await requireOrgAdmin(league.orgId, userId);
      isAdmin = true;
    } catch {
      // Not admin — read-only view
    }
  }

  // WSM-000173: league-wide synthetic-roster generation — admins only, flagged.
  const canGenerateRosters = isAdmin && (await syntheticRostersV1());

  const seasons = await getSeasons([id]).catch(() => []);
  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const upcomingSeason = seasons.find((s) => s.status === "upcoming") ?? null;
  const [fixtures, bracket, leaguePlayers, teams] = await Promise.all([
    activeSeason
      ? listFixturesBySeason(activeSeason.id).catch(() => [])
      : Promise.resolve([]),
    activeSeason
      ? getPlayoffBracket(activeSeason.id).catch(() => null)
      : Promise.resolve(null),
    isAdmin && league.orgId
      ? getPlayers([id]).catch(() => [])
      : Promise.resolve([]),
    isAdmin && league.orgId
      ? getTeamsByLeague(id, orgContext).catch(() => [])
      : Promise.resolve([]),
  ]);
  const decidedCtx = activeSeason
    ? seasonDecidedContext(fixtures, bracket)
    : {
        seasonDecided: false,
        unplayedGames: 0,
        playoffsUndecided: false,
      };
  const seasonStarted = activeSeason
    ? isSeasonStarted(activeSeason, fixtures)
    : false;
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const graduatedPlayers =
    isAdmin && league.orgId
      ? leaguePlayers
          .filter((p) => p.status === "graduated")
          .map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            teamName: teamNameById.get(p.teamId) ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
  const dynastySeasonStateLine = dynastySeasonState({
    activeSeason: activeSeason
      ? { name: activeSeason.name }
      : null,
    upcomingSeason: upcomingSeason
      ? { name: upcomingSeason.name }
      : null,
    seasonDecided: decidedCtx.seasonDecided,
  });
  const startNextSeasonGate = evaluateStartNextSeason({
    activeSeason: activeSeason
      ? { id: activeSeason.id, name: activeSeason.name }
      : null,
    upcomingSeason: upcomingSeason
      ? { id: upcomingSeason.id, name: upcomingSeason.name }
      : null,
    ...decidedCtx,
  });

  const contextParts: string[] = [];
  if (teams.length > 0) {
    contextParts.push(
      `${teams.length} team${teams.length === 1 ? "" : "s"}`,
    );
  }
  contextParts.push(
    `${seasons.length} season${seasons.length === 1 ? "" : "s"}`,
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leagues", href: "/dashboard/leagues" },
          { label: league.name },
        ]}
      />
      <WorkspaceHeader
        title={league.name}
        status={
          league.orgId ? (
            <Badge variant="secondary" className="shrink-0">
              Organization
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              Public
            </Badge>
          )
        }
        sub={contextParts.join(" · ")}
        actions={
          isAdmin && league.orgId ? (
            <div className="flex items-center gap-1">
              <RenameLeagueForm leagueId={id} currentName={league.name} />
              <DeleteLeagueButton leagueId={id} leagueName={league.name} />
            </div>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="pt-6">
          {isAdmin && league.orgId && (
            <div className="space-y-6">
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
              {isAdmin && league.orgId && (
                <DynastyPanel
                  leagueId={id}
                  seasonState={dynastySeasonStateLine}
                  gate={startNextSeasonGate}
                  classDistribution={summarizeClassDistribution(leaguePlayers)}
                  graduatedPlayers={graduatedPlayers}
                  upcomingSeason={
                    upcomingSeason
                      ? { id: upcomingSeason.id, name: upcomingSeason.name }
                      : null
                  }
                  unplayedGames={decidedCtx.unplayedGames}
                  playoffsUndecided={decidedCtx.playoffsUndecided}
                />
              )}
              {canGenerateRosters && (
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <div className="min-w-0">
                    <p className="text-label-14 text-foreground">Synthetic rosters</p>
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
                    <SyntheticRosterButton kind="league" id={id} action="clear" />
                  </div>
                </div>
              )}
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
          )}
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              You have read-only access to this league.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

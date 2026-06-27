import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getLeague,
  getLeagueVisibility,
  getLeagueClaimable,
} from "@/lib/data-api";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
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

  return (
    <div>
      <Link
        href="/dashboard/leagues"
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Leagues
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <Trophy className="h-5 w-5 shrink-0 text-primary" />
              <CardTitle className="truncate">{league.name}</CardTitle>
              {league.orgId ? (
                <Badge variant="secondary" className="shrink-0">
                  Organization
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0">
                  Public
                </Badge>
              )}
            </div>
            {isAdmin && league.orgId && (
              <div className="flex items-center gap-1">
                <RenameLeagueForm leagueId={id} currentName={league.name} />
                <DeleteLeagueButton leagueId={id} leagueName={league.name} />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isAdmin && league.orgId && (
            <div className="space-y-6">
              <InviteForm orgId={league.orgId} />
              <InvitationList orgId={league.orgId} />
              <InviteLinkSection orgId={league.orgId} />
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
              {canGenerateRosters && (
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <div className="min-w-0">
                    <p className="text-label-14 text-foreground">Synthetic rosters</p>
                    <p className="text-caption-12 text-text-muted">
                      Fill every team in this league with fake test players (~48
                      each) for demos. Not real people.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SyntheticRosterButton kind="league" id={id} />
                    <SyntheticRosterButton kind="league" id={id} action="attributes" />
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

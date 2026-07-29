import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildCoachSiblingLinks,
  coachHomeHref,
} from "@/components/workspace/resource-navigation";
import {
  getCoach,
  getTeam,
  getTeamLeagueId,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { dynastyProgramV1, pageGuard } from "@/lib/flags";
import { formatCoachArchetype } from "@/lib/program/coach";
import { Card, CardContent } from "@/components/ui/card";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function CoachHomePage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  await pageGuard(dynastyProgramV1);

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { coachId } = await params;
  const orgContext = await resolveOrgContext(userId);

  const coach = await getCoach(coachId).catch(() => null);
  if (!coach || !coach.teamId) notFound();

  const team = await getTeam(coach.teamId, orgContext).catch(() => null);
  if (!team) notFound();

  const leagueId = await getTeamLeagueId(coach.teamId).catch(() => null);
  if (!leagueId) notFound();
  await syncActiveLeagueForResource(leagueId);

  const siblings = buildCoachSiblingLinks(coachId);

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="coach"
        title={coach.displayName}
        homeHref={coachHomeHref(coachId)}
        context={team.name}
        siblings={siblings}
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Archetype
            </p>
            <p className="text-sm">{formatCoachArchetype(coach.archetype)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Prestige
            </p>
            <p className="text-sm">{coach.prestige}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Offense preference
            </p>
            <p className="text-sm">
              {coach.offensiveSchemePreference ?? "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Defense preference
            </p>
            <p className="text-sm">
              {coach.defensiveSchemePreference ?? "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Development
            </p>
            <p className="text-sm">
              {coach.developmentRating ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Recruiting
            </p>
            <p className="text-sm">
              {coach.recruitingRating ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

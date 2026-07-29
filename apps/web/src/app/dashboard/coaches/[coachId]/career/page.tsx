import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildCoachSiblingLinks,
  coachHomeHref,
} from "@/components/workspace/resource-navigation";
import {
  getCoach,
  getSeasons,
  getTeam,
  listCoachSeasons,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { dynastyProgramV1, pageGuard } from "@/lib/flags";
import { Card, CardContent } from "@/components/ui/card";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function CoachCareerPage({
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
  if (!coach) notFound();

  const leagueId = coach.leagueId;
  await syncActiveLeagueForResource(leagueId);

  const team = coach.teamId
    ? await getTeam(coach.teamId, orgContext).catch(() => null)
    : null;

  const [seasonRows, seasons] = await Promise.all([
    listCoachSeasons(coachId).catch(() => []),
    getSeasons([leagueId]).catch(() => []),
  ]);
  const seasonNameById = new Map(seasons.map((s) => [s.id, s.name]));

  const siblings = buildCoachSiblingLinks(coachId);

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="coach"
        title="Career"
        homeHref={coachHomeHref(coachId)}
        context={coach.displayName}
        siblings={siblings}
      />

      <Card>
        <CardContent className="pt-6">
          {seasonRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No seasons on record yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {seasonRows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 last:border-0"
                >
                  <span className="text-sm font-medium">
                    {seasonNameById.get(row.seasonId) ?? row.seasonId}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {row.wins}-{row.losses}
                    {row.ties > 0 ? `-${row.ties}` : ""}
                    {row.playoffResult ? ` · ${row.playoffResult}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

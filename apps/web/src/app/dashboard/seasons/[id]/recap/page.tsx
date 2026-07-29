import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildSeasonSiblingLinks,
  seasonHomeHref,
} from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";
import { getLeague, getSeason, getSeasonRecap } from "@/lib/data-api";
import {
  dynastyHistoryV1,
  pageGuard,
  playoffsV1,
  schedulesStandingsV1,
  statKeepingV1,
} from "@/lib/flags";
import { resolveOrgContext } from "@/lib/org-context";

export default async function SeasonRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pageGuard(dynastyHistoryV1);
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: seasonId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const season = await getSeason(seasonId, orgContext).catch(() => null);
  if (!season || season.status !== "completed") notFound();
  const league = await getLeague(season.leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const [
    recap,
    scheduleEnabled,
    playoffsEnabled,
    statsEnabled,
  ] = await Promise.all([
    getSeasonRecap(season.id).catch(() => null),
    schedulesStandingsV1(),
    playoffsV1(),
    statKeepingV1(),
  ]);

  return (
    <div className="space-y-4" data-testid="season-recap">
      <ResourceHeader
        kind="season"
        title="Season recap"
        homeHref={seasonHomeHref(season.id)}
        context={`${season.name} · ${league.name}`}
        siblings={buildSeasonSiblingLinks({
          seasonId: season.id,
          scheduleEnabled,
          playoffsEnabled,
          statsEnabled,
          offseasonEnabled: false,
          awardsEnabled: true,
          rankingsEnabled: true,
          recapEnabled: true,
        })}
      />

      {!recap || recap.blocks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No season recap is available.
          </CardContent>
        </Card>
      ) : (
        recap.blocks.map((block) => (
          <Card key={block.key} data-testid="recap-storyline">
            <CardHeader>
              <CardTitle>{block.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7 text-foreground">{block.body}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

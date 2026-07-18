import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { statKeepingV1, schedulesStandingsV1, playoffsV1 } from "@/lib/flags";
import { getLeague, getSeasons, getSeasonStatLeaders } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/card";
import { StatLeadersBoard } from "@/components/stats/StatLeadersBoard";
import SeasonSwitcher from "@/components/schedule/SeasonSwitcher";
import { resolveViewedSeason } from "@/lib/season-view";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import { leagueHomeHref } from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function LeagueStatLeadersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  // Same dark-flag gate as the rest of stat-keeping (WSM-000112).
  const enabled = await statKeepingV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: leagueId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const { season: seasonParam } = await searchParams;
  const allSeasons = await getSeasons([leagueId]);
  const activeSeason = resolveViewedSeason(allSeasons, seasonParam);

  const scheduleEnabled = await schedulesStandingsV1();
  const playoffsEnabled = await playoffsV1();

  const peerNavLinks = buildLeagueSeasonNavLinks({
    leagueId,
    seasonId: activeSeason?.id ?? null,
    scheduleEnabled,
    playoffsEnabled,
    statsEnabled: enabled,
    exclude: "stats",
  });

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="league"
        name={league.name}
        href={leagueHomeHref(leagueId)}
        subtitle={`Stat leaders${activeSeason ? ` · ${activeSeason.name}` : ""}`}
        actions={
          activeSeason ? (
            <SeasonSwitcher
              seasons={allSeasons.map((s) => ({
                id: s.id,
                name: s.name,
                status: s.status,
              }))}
              currentSeasonId={activeSeason.id}
            />
          ) : null
        }
      />
      <WorkspaceNav links={peerNavLinks} />

      {!activeSeason ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No seasons in this league yet — stat leaders unavailable.
          </CardContent>
        </Card>
      ) : (
        <StatLeadersBoard
          categories={await getSeasonStatLeaders(activeSeason.id)}
        />
      )}
    </div>
  );
}

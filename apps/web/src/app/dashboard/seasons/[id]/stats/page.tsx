import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { statKeepingV1, schedulesStandingsV1, playoffsV1 } from "@/lib/flags";
import { getLeague, getSeason, getSeasons, getSeasonStatLeaders } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/card";
import { StatLeadersBoard } from "@/components/stats/StatLeadersBoard";
import SeasonSwitcher from "@/components/schedule/SeasonSwitcher";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  leagueHomeHref,
  seasonHomeHref,
} from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function SeasonStatLeadersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await statKeepingV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: seasonId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const season = await getSeason(seasonId, orgContext).catch(() => null);
  if (!season) notFound();

  const league = await getLeague(season.leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const allSeasons = await getSeasons([league.id]);

  const scheduleEnabled = await schedulesStandingsV1();
  const playoffsEnabled = await playoffsV1();

  const peerNavLinks = buildLeagueSeasonNavLinks({
    leagueId: league.id,
    seasonId: season.id,
    scheduleEnabled,
    playoffsEnabled,
    statsEnabled: enabled,
    exclude: "stats",
  });

  return (
    <div className="space-y-4">
      <ResourceHeader
        kind="season"
        name={season.name}
        href={seasonHomeHref(seasonId)}
        subtitle={`Stat leaders · ${league.name}`}
        context={
          <a
            href={leagueHomeHref(league.id)}
            className="text-accent hover:underline"
          >
            {league.name}
          </a>
        }
        actions={
          <SeasonSwitcher
            seasons={allSeasons.map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
            }))}
            currentSeasonId={season.id}
          />
        }
      />
      <WorkspaceNav links={peerNavLinks} />

      <StatLeadersBoard categories={await getSeasonStatLeaders(season.id)} />
    </div>
  );
}

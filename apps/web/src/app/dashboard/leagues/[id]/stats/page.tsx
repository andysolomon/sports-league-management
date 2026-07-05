import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { statKeepingV1 } from "@/lib/flags";
import { getLeague, getSeasons, getSeasonStatLeaders } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/card";
import { StatLeadersBoard } from "@/components/stats/StatLeadersBoard";
import SeasonSwitcher from "@/components/schedule/SeasonSwitcher";
import { resolveViewedSeason } from "@/lib/season-view";

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

  const { season: seasonParam } = await searchParams;
  const allSeasons = await getSeasons([leagueId]);
  const activeSeason = resolveViewedSeason(allSeasons, seasonParam);

  return (
    <div>
      <Link
        href={`/dashboard/leagues/${leagueId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to League
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{league.name}</h2>
          <p className="text-sm text-muted-foreground">
            Stat leaders{activeSeason ? ` · ${activeSeason.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeSeason ? (
            <SeasonSwitcher
              seasons={allSeasons.map((s) => ({
                id: s.id,
                name: s.name,
                status: s.status,
              }))}
              currentSeasonId={activeSeason.id}
            />
          ) : null}
          <Link
            href={`/dashboard/leagues/${leagueId}/standings`}
            className="text-sm text-primary hover:underline"
          >
            Standings &rarr;
          </Link>
        </div>
      </header>

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

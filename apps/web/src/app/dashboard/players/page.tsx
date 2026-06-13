import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlayers, getLeagues, getTeams } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/8bit/card";
import { EmptyState } from "@/components/empty-state";
import { Trophy, Users, ChevronRight } from "lucide-react";
import { PlayersTable } from "./players-table";

/*
 * Players tab (WSM-000101). Leagues first: the landing view lists the user's
 * leagues with player counts rather than lumping every player into one giant
 * table. Drilling into a league (`?league=<id>`) shows just that league's
 * players. A single league still lands on the picker so the hierarchy is
 * consistent as more leagues are added (e.g. via à la carte import).
 */
export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const { league: selectedLeague } = await searchParams;

  // Drill-down: a specific league's players.
  if (selectedLeague && orgContext.visibleLeagueIds.includes(selectedLeague)) {
    const [leagues, players] = await Promise.all([
      getLeagues(orgContext.visibleLeagueIds),
      getPlayers([selectedLeague]),
    ]);
    const leagueName =
      leagues.find((l) => l.id === selectedLeague)?.name ?? "League";

    return (
      <div>
        <Link
          href="/dashboard/players"
          className="mb-4 inline-block text-sm text-primary hover:underline"
        >
          &larr; All leagues
        </Link>
        <h2 className="mb-6 text-lg font-semibold text-foreground">
          {leagueName} — Players
        </h2>
        <PlayersTable players={players} />
      </div>
    );
  }

  // Landing: leagues with player counts.
  const [leagues, teams, players] = await Promise.all([
    getLeagues(orgContext.visibleLeagueIds),
    getTeams(orgContext.visibleLeagueIds),
    getPlayers(orgContext.visibleLeagueIds),
  ]);

  const teamLeague = new Map(teams.map((t) => [t.id, t.leagueId]));
  const countByLeague = new Map<string, number>();
  for (const p of players) {
    const leagueId = teamLeague.get(p.teamId);
    if (leagueId)
      countByLeague.set(leagueId, (countByLeague.get(leagueId) ?? 0) + 1);
  }

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Players</h2>
      {leagues.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leagues yet"
          description="Subscribe to a league from Discover, or create one, to see players here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/dashboard/players?league=${league.id}`}
            >
              <Card className="transition-colors hover:border-primary">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Trophy className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {league.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {countByLeague.get(league.id) ?? 0} players
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

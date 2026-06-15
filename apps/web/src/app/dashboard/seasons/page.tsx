import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSeasons, getLeagues } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Calendar, Trophy } from "lucide-react";
import { formatDate } from "@/lib/format";
import { CreateSeasonButton, SeasonRowActions } from "./season-actions";

export default async function SeasonsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const ids = orgContext.visibleLeagueIds;
  const [seasons, leagues] = await Promise.all([
    getSeasons(ids),
    getLeagues(ids),
  ]);

  const seasonsByLeague = new Map<string, typeof seasons>();
  for (const season of seasons) {
    const existing = seasonsByLeague.get(season.leagueId) ?? [];
    existing.push(season);
    seasonsByLeague.set(season.leagueId, existing);
  }

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Seasons</h2>

      {leagues.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No leagues yet"
          description="Create a league first, then add a season to unlock rosters, schedules, and player attributes."
        />
      ) : (
        <div className="space-y-6">
          {leagues.map((league) => {
            const leagueSeasons = seasonsByLeague.get(league.id) ?? [];
            return (
              <Card key={league.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Trophy className="h-5 w-5 shrink-0 text-primary" />
                      <CardTitle className="truncate">{league.name}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">
                        {leagueSeasons.length} season
                        {leagueSeasons.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <CreateSeasonButton leagueId={league.id} />
                  </div>
                </CardHeader>
                <CardContent>
                  {leagueSeasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No seasons yet. Create one to enable rosters, schedules,
                      and attributes.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {leagueSeasons.map((season) => (
                        <li
                          key={season.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-3">
                            <span className="font-medium text-foreground">
                              {season.name}
                            </span>
                            <StatusBadge status={season.status} />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(season.startDate)} &ndash;{" "}
                              {formatDate(season.endDate)}
                            </span>
                          </div>
                          <SeasonRowActions season={season} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

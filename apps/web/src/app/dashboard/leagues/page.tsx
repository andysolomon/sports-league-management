import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLeagues, getDivisions, getTeams } from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/8bit/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Trophy, Layers, Users } from "lucide-react";

export default async function LeaguesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const ids = orgContext.visibleLeagueIds;

  const [leagues, divisions, teams] = await Promise.all([
    getLeagues(ids),
    getDivisions(ids),
    getTeams(ids),
  ]);

  const divisionsByLeague = new Map<string, typeof divisions>();
  for (const div of divisions) {
    const existing = divisionsByLeague.get(div.leagueId) ?? [];
    existing.push(div);
    divisionsByLeague.set(div.leagueId, existing);
  }

  const teamsByDivision = new Map<string, typeof teams>();
  for (const team of teams) {
    const existing = teamsByDivision.get(team.divisionId) ?? [];
    existing.push(team);
    teamsByDivision.set(team.divisionId, existing);
  }

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Leagues</h2>

      {leagues.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No leagues found"
          description="Leagues will appear here once created in the system."
        />
      ) : (
        <div className="space-y-6">
          {leagues.map((league) => {
            const leagueDivisions = divisionsByLeague.get(league.id) ?? [];

            return (
              <Card key={league.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Trophy className="h-5 w-5 text-primary" />
                    <CardTitle>
                      <Link href={`/dashboard/leagues/${league.id}`} className="hover:underline">
                        {league.name}
                      </Link>
                    </CardTitle>
                    <Badge variant="secondary">
                      {leagueDivisions.length} division
                      {leagueDivisions.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {leagueDivisions.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No divisions in this league.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {leagueDivisions.map((division) => {
                        const divTeams =
                          teamsByDivision.get(division.id) ?? [];

                        return (
                          <div key={division.id}>
                            <div className="mb-2 flex items-center gap-2">
                              <Layers className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                {division.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {divTeams.length} team
                                {divTeams.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            {divTeams.length > 0 ? (
                              <div className="ml-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {divTeams.map((team) => (
                                  <Link
                                    key={team.id}
                                    href={`/dashboard/teams/${team.id}`}
                                    className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-colors hover:bg-gray-100"
                                  >
                                    <Users className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="font-medium text-gray-700">
                                      {team.name}
                                    </span>
                                    {team.city && (
                                      <span className="text-gray-400">
                                        &mdash; {team.city}
                                      </span>
                                    )}
                                  </Link>
                                ))}
                              </div>
                            ) : (
                              <p className="ml-6 text-sm text-gray-400">
                                No teams in this division.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
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

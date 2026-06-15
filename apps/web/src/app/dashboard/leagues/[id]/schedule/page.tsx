import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { schedulesStandingsV1 } from "@/lib/flags";
import {
  getLeague,
  getLeagueOrgId,
  getSeasons,
  getResultByFixture,
  getTeamsByLeague,
  listFixturesBySeason,
} from "@/lib/data-api";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FixtureFormDialog from "@/components/schedule/FixtureFormDialog";
import RecordResultDialog from "@/components/schedule/RecordResultDialog";
import DeleteFixtureButton from "@/components/schedule/DeleteFixtureButton";
import { Button } from "@/components/ui/button";

export default async function LeagueSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await schedulesStandingsV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: leagueId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) notFound();

  // Manager gate: admins and coaches see "New fixture" + "Record result"
  // (coaches run schedules/results, WSM-000121).
  const orgId = await getLeagueOrgId(leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  const isAdmin = canManageRoster(role);

  // Pick the active season — fall back to whichever exists if none flagged active.
  const allSeasons = await getSeasons([leagueId]);
  const activeSeason =
    allSeasons.find((s) => s.status === "active") ?? allSeasons[0] ?? null;

  const teams = await getTeamsByLeague(leagueId, orgContext);

  const fixtures = activeSeason
    ? await listFixturesBySeason(activeSeason.id)
    : [];

  // Hydrate per-fixture result for "Record result" pre-fill + score display.
  const fixturesWithResults = await Promise.all(
    fixtures.map(async (f) => {
      const result =
        f.status === "final" ? await getResultByFixture(f.id) : null;
      return { fixture: f, result };
    }),
  );

  // Group by week (null week → "Unscheduled" bucket at the end).
  const buckets = new Map<number | null, typeof fixturesWithResults>();
  for (const row of fixturesWithResults) {
    const key = row.fixture.week;
    const arr = buckets.get(key) ?? [];
    arr.push(row);
    buckets.set(key, arr);
  }
  const weekKeys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

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
            Schedule {activeSeason ? `· ${activeSeason.name}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/leagues/${leagueId}/standings`}
            className="text-sm text-primary hover:underline"
          >
            Standings &rarr;
          </Link>
          {isAdmin && activeSeason ? (
            <FixtureFormDialog
              leagueId={leagueId}
              seasonId={activeSeason.id}
              teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            />
          ) : null}
        </div>
      </header>

      {!activeSeason ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Scheduling needs a season. Create one to add fixtures and record
              results.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/seasons">Go to Seasons</Link>
            </Button>
          </CardContent>
        </Card>
      ) : weekKeys.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No fixtures scheduled yet for {activeSeason.name}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {weekKeys.map((week) => {
            const rows = buckets.get(week)!;
            return (
              <Card key={week ?? "unscheduled"}>
                <CardHeader>
                  <CardTitle>
                    {week === null ? "Unscheduled" : `Week ${week}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted text-left text-foreground">
                        <th className="px-4 py-2 font-mono text-xs uppercase">
                          When
                        </th>
                        <th className="px-4 py-2 font-mono text-xs uppercase">
                          Home
                        </th>
                        <th className="px-4 py-2 font-mono text-xs uppercase">
                          Away
                        </th>
                        <th className="px-4 py-2 text-right font-mono text-xs uppercase">
                          Score
                        </th>
                        <th className="px-4 py-2 font-mono text-xs uppercase">
                          Status
                        </th>
                        {isAdmin ? (
                          <th className="px-4 py-2 font-mono text-xs uppercase">
                            Actions
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ fixture, result }) => (
                        <tr key={fixture.id} className="border-b border-border">
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                            {fixture.scheduledAt
                              ? new Date(fixture.scheduledAt).toLocaleString()
                              : "TBD"}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {fixture.homeTeamName}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {fixture.awayTeamName}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-foreground">
                            {result
                              ? `${result.homeScore} – ${result.awayScore}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs uppercase text-muted-foreground">
                            {fixture.status}
                          </td>
                          {isAdmin ? (
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <RecordResultDialog
                                  leagueId={leagueId}
                                  fixtureId={fixture.id}
                                  homeTeamName={fixture.homeTeamName}
                                  awayTeamName={fixture.awayTeamName}
                                  initialHomeScore={result?.homeScore ?? null}
                                  initialAwayScore={result?.awayScore ?? null}
                                  triggerLabel={result ? "Edit result" : "Record result"}
                                />
                                <DeleteFixtureButton
                                  leagueId={leagueId}
                                  fixtureId={fixture.id}
                                  homeTeamName={fixture.homeTeamName}
                                  awayTeamName={fixture.awayTeamName}
                                />
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

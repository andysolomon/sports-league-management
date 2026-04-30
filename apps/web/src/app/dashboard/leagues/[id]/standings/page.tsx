import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { schedulesStandingsV1 } from "@/lib/flags";
import {
  computeStandings,
  getDivisions,
  getLeague,
  getSeasons,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/8bit/card";
import StandingsTable from "@/components/schedule/StandingsTable";
import { trackStandingsView } from "@/lib/analytics";

export default async function LeagueStandingsPage({
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

  const allSeasons = await getSeasons([leagueId]);
  const activeSeason =
    allSeasons.find((s) => s.status === "active") ?? allSeasons[0] ?? null;

  if (!activeSeason) {
    return (
      <div>
        <Link
          href={`/dashboard/leagues/${leagueId}`}
          className="mb-4 inline-block text-sm text-primary hover:underline"
        >
          &larr; Back to League
        </Link>
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          {league.name}
        </h2>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No seasons in this league yet — standings unavailable.
          </CardContent>
        </Card>
      </div>
    );
  }

  const standings = await computeStandings(activeSeason.id);
  const divisions = await getDivisions([leagueId]);
  void trackStandingsView({ leagueId, route: "dashboard" });

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
            Standings · {activeSeason.name}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/dashboard/leagues/${leagueId}/schedule`}
            className="text-sm text-primary hover:underline"
          >
            Schedule &rarr;
          </Link>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Season standings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {standings.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No teams or no recorded results yet for {activeSeason.name}.
            </p>
          ) : (
            <StandingsTable rows={standings} />
          )}
        </CardContent>
      </Card>

      {divisions.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Division ranks are computed across {divisions.length}{" "}
          {divisions.length === 1 ? "division" : "divisions"} in this league.
        </p>
      ) : null}
    </div>
  );
}

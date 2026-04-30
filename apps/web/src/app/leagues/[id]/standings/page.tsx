import { notFound } from "next/navigation";
import Link from "next/link";
import { schedulesStandingsV1 } from "@/lib/flags";
import { computeStandingsPublic } from "@/lib/data-api";
import { publicLeagueGuard } from "@/lib/public-league-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/8bit/card";
import StandingsTable from "@/components/schedule/StandingsTable";

/*
 * Public viewer route (Phase 3 / WSM-000073).
 *
 * NO Clerk session required. `publicLeagueGuard` 404s if the league
 * isn't opt-in public. The Convex query layers the same check in
 * `computeStandingsPublic` so a stale or skipped middleware can't
 * leak data.
 */
export default async function PublicLeagueStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await schedulesStandingsV1();
  if (!enabled) notFound();

  const { id: leagueId } = await params;
  await publicLeagueGuard(leagueId);

  const standings = await computeStandingsPublic(leagueId);
  if (standings === null) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/leagues/${leagueId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to League
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Standings</h1>
        <p className="text-sm text-muted-foreground">{standings.seasonName}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Season standings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {standings.rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No teams or no recorded results yet for {standings.seasonName}.
            </p>
          ) : (
            <StandingsTable rows={standings.rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

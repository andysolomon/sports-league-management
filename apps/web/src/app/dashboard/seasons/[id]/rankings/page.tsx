import { auth } from "@clerk/nextjs/server";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildSeasonSiblingLinks,
  seasonHomeHref,
} from "@/components/workspace/resource-navigation";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";
import { getLeague, getSeason, getWeeklyPoll } from "@/lib/data-api";
import {
  dynastyHistoryV1,
  dynastyOffseasonV2,
  pageGuard,
  playoffsV1,
  schedulesStandingsV1,
  statKeepingV1,
} from "@/lib/flags";
import { resolveOrgContext } from "@/lib/org-context";

function recordLabel(record: {
  wins: number;
  losses: number;
  ties: number;
}): string {
  return record.ties > 0
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;
}

function Movement({
  rank,
  previousRank,
}: {
  rank: number;
  previousRank: number | null;
}) {
  if (previousRank === null) {
    return <span className="text-xs text-muted-foreground">New</span>;
  }
  const movement = previousRank - rank;
  if (movement > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <ArrowUp className="h-4 w-4" aria-hidden />
        <span>{movement}</span>
        <span className="sr-only">Up {movement}</span>
      </span>
    );
  }
  if (movement < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <ArrowDown className="h-4 w-4" aria-hidden />
        <span>{Math.abs(movement)}</span>
        <span className="sr-only">Down {Math.abs(movement)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-muted-foreground">
      <Minus className="h-4 w-4" aria-hidden />
      <span className="sr-only">No change</span>
    </span>
  );
}

export default async function SeasonRankingsPage({
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
  if (!season) notFound();
  const league = await getLeague(season.leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const [
    poll,
    scheduleEnabled,
    playoffsEnabled,
    statsEnabled,
    offseasonEnabled,
  ] = await Promise.all([
    getWeeklyPoll(season.id).catch(() => null),
    schedulesStandingsV1(),
    playoffsV1(),
    statKeepingV1(),
    dynastyOffseasonV2(),
  ]);

  return (
    <div className="space-y-4" data-testid="season-rankings">
      <ResourceHeader
        kind="season"
        title="Power rankings"
        homeHref={seasonHomeHref(season.id)}
        context={`${season.name} · ${league.name}`}
        siblings={buildSeasonSiblingLinks({
          seasonId: season.id,
          scheduleEnabled,
          playoffsEnabled,
          statsEnabled,
          offseasonEnabled: offseasonEnabled && season.status === "upcoming",
          awardsEnabled: true,
          rankingsEnabled: true,
          recapEnabled: season.status === "completed",
        })}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {poll ? `Week ${poll.week} poll` : "Weekly poll"}
          </CardTitle>
        </CardHeader>
        <CardContent className={poll ? "p-0" : undefined}>
          {!poll || poll.rankings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Rankings publish after a week of games is simulated.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead className="text-center">Movement</TableHead>
                  <TableHead className="text-center">Record</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poll.rankings.map((ranking) => (
                  <TableRow key={ranking.teamId}>
                    <TableCell className="text-center text-lg font-semibold">
                      {ranking.rank}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/teams/${ranking.teamId}`}
                        className="font-medium hover:underline"
                      >
                        {ranking.teamName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Movement
                        rank={ranking.rank}
                        previousRank={ranking.previousRank}
                      />
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {recordLabel(ranking.record)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ranking.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

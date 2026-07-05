import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { statKeepingV1 } from "@/lib/flags";
import {
  getFixture,
  getLeague,
  getPlayerGameStatsByFixture,
  getPlayersByTeam,
  getResultByFixture,
  getSeasonLeagueId,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import {
  buildBoxScoreTables,
  type BoxScoreGroupTable,
  type BoxScorePlayerInfo,
} from "@/lib/box-score";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

/*
 * Read-only game box score (WSM-000212). Linked from the schedule's score cell.
 * Unlike /dashboard/teams/[id]/games/[gameId]/stats (the coach-gated ENTRY
 * form), this renders both teams' entered stat lines for anyone who can see
 * the league — same guard chain as the gamecast page: stat-keeping flag,
 * auth, then league visibility through getLeague + orgContext.
 */

function TeamBoxScore({
  teamName,
  tables,
}: {
  teamName: string;
  tables: BoxScoreGroupTable[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{teamName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {tables.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No player stats entered for {teamName}.
          </p>
        ) : (
          tables.map((table) => (
            <div key={table.key}>
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                {table.label}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1.5 pr-4 font-mono text-xs uppercase">
                        Player
                      </th>
                      {table.fields.map((f) => (
                        <th
                          key={f.key}
                          className="py-1.5 pr-3 text-right font-mono text-xs uppercase"
                        >
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr
                        key={row.playerId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-1.5 pr-4 text-foreground">
                          {row.jerseyNumber !== null && (
                            <span className="mr-2 font-mono text-xs text-muted-foreground">
                              #{row.jerseyNumber}
                            </span>
                          )}
                          {row.playerName}
                        </td>
                        {row.values.map((v, i) => (
                          <td
                            key={table.fields[i].key}
                            className="py-1.5 pr-3 text-right font-mono tabular-nums text-foreground"
                          >
                            {v ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default async function BoxScorePage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const enabled = await statKeepingV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { fixtureId } = await params;
  const fixture = await getFixture(fixtureId);
  if (!fixture) notFound();

  const leagueId = await getSeasonLeagueId(fixture.seasonId);
  if (!leagueId) notFound();

  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) notFound();

  const [result, allStats, homePlayers, awayPlayers] = await Promise.all([
    getResultByFixture(fixtureId),
    getPlayerGameStatsByFixture(fixtureId),
    getPlayersByTeam(fixture.homeTeamId, orgContext).catch(() => []),
    getPlayersByTeam(fixture.awayTeamId, orgContext).catch(() => []),
  ]);

  const playersById = new Map<string, BoxScorePlayerInfo>();
  for (const p of [...homePlayers, ...awayPlayers]) {
    playersById.set(p.id, { name: p.name, jerseyNumber: p.jerseyNumber });
  }

  const homeTables = buildBoxScoreTables(
    allStats.filter((s) => s.teamId === fixture.homeTeamId),
    playersById,
  );
  const awayTables = buildBoxScoreTables(
    allStats.filter((s) => s.teamId === fixture.awayTeamId),
    playersById,
  );
  const hasAnyStats = homeTables.length > 0 || awayTables.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/dashboard/leagues/${leagueId}/schedule`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Schedule
      </Link>

      <header className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Box score</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {fixture.homeTeamName} vs {fixture.awayTeamName}
            {fixture.week !== null ? ` · Week ${fixture.week}` : ""}
          </span>
          <StatusBadge status={fixture.status} />
        </div>
        {result && (
          <p className="mt-3 font-mono text-3xl tabular-nums text-foreground">
            {result.homeScore} – {result.awayScore}
          </p>
        )}
      </header>

      {!hasAnyStats ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No player stats have been entered for this game yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <TeamBoxScore teamName={fixture.homeTeamName} tables={homeTables} />
          <TeamBoxScore teamName={fixture.awayTeamName} tables={awayTables} />
        </div>
      )}
    </div>
  );
}

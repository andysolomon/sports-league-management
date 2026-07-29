import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  getLeague,
  getTeamsByLeague,
  listProgramRecords,
  type ProgramRecordDto,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  leagueHomeHref,
  leagueSubpageHref,
} from "@/components/workspace/resource-navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function groupByCategory(
  records: ProgramRecordDto[],
): Array<{ category: string; label: string; rows: ProgramRecordDto[] }> {
  const groups = new Map<
    string,
    { category: string; label: string; rows: ProgramRecordDto[] }
  >();
  for (const record of records) {
    const group = groups.get(record.category) ?? {
      category: record.category,
      label: record.categoryLabel,
      rows: [],
    };
    group.rows.push(record);
    groups.set(record.category, group);
  }
  return [...groups.values()];
}

export default async function LeagueHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(id, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const teams = await getTeamsByLeague(id, orgContext).catch(() => []);
  const requestedTeamId =
    typeof query.team === "string" ? query.team : null;
  const selectedTeam =
    teams.find((team) => team.id === requestedTeamId) ?? null;
  const records = await listProgramRecords(
    id,
    selectedTeam?.id ?? null,
    orgContext,
  ).catch(() => []);
  const groups = groupByCategory(records);
  const historyHref = leagueSubpageHref(id, "history", null);

  return (
    <div className="space-y-4" data-testid="record-book">
      <ResourceHeader
        kind="league"
        title="Record book"
        homeHref={leagueHomeHref(id)}
        context={league.name}
        siblings={[
          { label: "Overview", href: leagueHomeHref(id) },
          { label: "Record book", href: historyHref },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedTeam ? `${selectedTeam.name} records` : "League records"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <nav
            aria-label="Record book views"
            className="mb-6 flex flex-wrap gap-2"
            data-testid="record-book-views"
          >
            <Button
              asChild
              size="sm"
              variant={selectedTeam ? "outline" : "default"}
            >
              <Link href={historyHref}>League records</Link>
            </Button>
            {teams.map((team) => (
              <Button
                asChild
                key={team.id}
                size="sm"
                variant={selectedTeam?.id === team.id ? "default" : "outline"}
              >
                <Link href={`${historyHref}?team=${team.id}`}>{team.name}</Link>
              </Button>
            ))}
          </nav>

          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No completed-season records yet.
            </p>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              {groups.map((group) => (
                <section
                  key={group.category}
                  aria-labelledby={`record-category-${group.category}`}
                  className="overflow-hidden rounded-lg border"
                >
                  <h2
                    id={`record-category-${group.category}`}
                    className="border-b bg-muted/30 px-4 py-3 font-semibold"
                  >
                    {group.label}
                  </h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Rank</TableHead>
                        <TableHead>Holder</TableHead>
                        <TableHead>Season</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.rank}</TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {record.playerName ?? record.teamName}
                            </div>
                            {record.playerName ? (
                              <div className="text-xs text-muted-foreground">
                                {record.teamName}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{record.seasonName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {record.value.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

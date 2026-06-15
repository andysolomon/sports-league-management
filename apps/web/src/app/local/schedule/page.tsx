"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type {
  FixtureDto,
  GameResultDto,
  LeagueDto,
  SeasonDto,
  Standing,
  TeamDto,
} from "@sports-management/shared-types";
import { useLocalProvider } from "@/lib/local/use-local-provider";
import { ensureLocalWorkspace } from "@/lib/local/local-workspace";
import type { LocalWorkspaceProvider } from "@/lib/local/local-workspace-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2 } from "lucide-react";

export default function LocalSchedulePage() {
  const provider = useLocalProvider();
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [seasons, setSeasons] = useState<SeasonDto[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  const [fixtures, setFixtures] = useState<FixtureDto[]>([]);
  const [results, setResults] = useState<Map<string, GameResultDto>>(new Map());
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  const [seasonName, setSeasonName] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [week, setWeek] = useState("");
  const [venue, setVenue] = useState("");

  const refreshSeason = useCallback(
    async (p: LocalWorkspaceProvider, sId: string) => {
      if (!sId) {
        setFixtures([]);
        setResults(new Map());
        setStandings([]);
        return;
      }
      const [fx, st] = await Promise.all([
        p.listFixturesBySeason(sId),
        p.computeStandings(sId),
      ]);
      const resultEntries = await Promise.all(
        fx.map(async (f) => [f.id, await p.getResultByFixture(f.id)] as const),
      );
      setFixtures(fx);
      setResults(
        new Map(
          resultEntries.filter(([, r]) => r !== null) as [
            string,
            GameResultDto,
          ][],
        ),
      );
      setStandings(st);
    },
    [],
  );

  const reload = useCallback(
    async (p: LocalWorkspaceProvider, preferSeasonId?: string) => {
      const lg = await ensureLocalWorkspace(p);
      setLeague(lg);
      const [t, s] = await Promise.all([
        p.listTeams(lg.id),
        p.listSeasons(lg.id),
      ]);
      setTeams(t);
      setSeasons(s);
      const nextSeason =
        preferSeasonId && s.some((x) => x.id === preferSeasonId)
          ? preferSeasonId
          : (s[0]?.id ?? "");
      setSeasonId(nextSeason);
      await refreshSeason(p, nextSeason);
      setLoading(false);
    },
    [refreshSeason],
  );

  useEffect(() => {
    // Justified: async load from the client-only IndexedDB provider once it
    // mounts. The setState calls run after awaits inside reload(), not as a
    // synchronous cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (provider) void reload(provider);
  }, [provider, reload]);

  // Re-derive fixtures/standings when the selected season changes.
  useEffect(() => {
    // Justified: async re-derive from the client-only provider on season change;
    // setState runs after awaits inside refreshSeason(), not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (provider && !loading) void refreshSeason(provider, seasonId);
    // Intentionally narrowed to seasonId so we don't re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  async function onCreateSeason(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || !league || !seasonName.trim()) return;
    const created = await provider.createSeason({
      name: seasonName.trim(),
      leagueId: league.id,
    });
    setSeasonName("");
    toast.success(`Created season ${created.name}.`);
    await reload(provider, created.id);
  }

  async function onDeleteSeason() {
    if (!provider || !seasonId) return;
    await provider.deleteSeason(seasonId);
    toast.success("Season deleted.");
    await reload(provider);
  }

  async function onAddFixture(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || !seasonId) return;
    if (!homeTeamId || !awayTeamId) {
      toast.error("Pick a home and away team.");
      return;
    }
    if (homeTeamId === awayTeamId) {
      toast.error("A team can't play itself.");
      return;
    }
    const weekNum = week.trim() === "" ? null : Number(week);
    if (weekNum !== null && !Number.isInteger(weekNum)) {
      toast.error("Week must be a whole number.");
      return;
    }
    await provider.createFixture({
      seasonId,
      homeTeamId,
      awayTeamId,
      week: weekNum,
      venue: venue.trim() || null,
    });
    setHomeTeamId("");
    setAwayTeamId("");
    setWeek("");
    setVenue("");
    await refreshSeason(provider, seasonId);
  }

  async function onRecord(fixtureId: string, home: number, away: number) {
    if (!provider) return;
    await provider.recordGameResult(fixtureId, home, away);
    await refreshSeason(provider, seasonId);
  }

  async function onDeleteFixture(id: string) {
    if (!provider) return;
    await provider.deleteFixture(id);
    await refreshSeason(provider, seasonId);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/local"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Workspace
        </Link>
        <h1 className="text-xl font-semibold text-foreground">
          Schedule &amp; standings
        </h1>
      </div>

      {/* Season picker / create */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Season</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {seasons.length > 0 && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="season">Active season</Label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger id="season">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={onDeleteSeason}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
          <form onSubmit={onCreateSeason} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="new-season">New season</Label>
              <Input
                id="new-season"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="2026 Fall"
              />
            </div>
            <Button type="submit" variant="outline">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {!seasonId ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Create a season to start building a schedule.
        </p>
      ) : (
        <>
          {/* Standings */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Standings</h2>
            {standings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teams yet — add teams in your workspace.
              </p>
            ) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">W</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-center">T</TableHead>
                      <TableHead className="text-center">PF</TableHead>
                      <TableHead className="text-center">PA</TableHead>
                      <TableHead className="text-center">Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((s) => (
                      <TableRow key={s.teamId}>
                        <TableCell className="text-muted-foreground">
                          {s.leagueRank}
                        </TableCell>
                        <TableCell className="font-medium">{s.teamName}</TableCell>
                        <TableCell className="text-center">{s.wins}</TableCell>
                        <TableCell className="text-center">{s.losses}</TableCell>
                        <TableCell className="text-center">{s.ties}</TableCell>
                        <TableCell className="text-center">{s.pointsFor}</TableCell>
                        <TableCell className="text-center">
                          {s.pointsAgainst}
                        </TableCell>
                        <TableCell className="text-center">
                          {s.pointsFor - s.pointsAgainst}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Fixtures */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">
              Fixtures{" "}
              <span className="text-muted-foreground">({fixtures.length})</span>
            </h2>
            {fixtures.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No games scheduled yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {fixtures.map((f) => (
                  <FixtureRow
                    key={f.id}
                    fixture={f}
                    result={results.get(f.id) ?? null}
                    onRecord={onRecord}
                    onDelete={onDeleteFixture}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Add fixture */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add a game</CardTitle>
              <CardDescription>Week and venue are optional.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={onAddFixture}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="home">Home</Label>
                  <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                    <SelectTrigger id="home">
                      <SelectValue placeholder="Home team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="away">Away</Label>
                  <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                    <SelectTrigger id="away">
                      <SelectValue placeholder="Away team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="week">Week</Label>
                  <Input
                    id="week"
                    inputMode="numeric"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Nest Field"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Button type="submit" disabled={teams.length < 2}>
                    Add game
                  </Button>
                  {teams.length < 2 && (
                    <span className="ml-3 text-xs text-muted-foreground">
                      Add at least two teams first.
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function FixtureRow({
  fixture,
  result,
  onRecord,
  onDelete,
}: {
  fixture: FixtureDto;
  result: GameResultDto | null;
  onRecord: (fixtureId: string, home: number, away: number) => void;
  onDelete: (id: string) => void;
}) {
  const [home, setHome] = useState(result ? String(result.homeScore) : "");
  const [away, setAway] = useState(result ? String(result.awayScore) : "");
  const isFinal = fixture.status === "final";

  function submit() {
    const h = Number(home);
    const a = Number(away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      toast.error("Enter whole-number scores.");
      return;
    }
    onRecord(fixture.id, h, a);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3 text-sm">
      <span className="flex items-center gap-2">
        {fixture.week !== null && (
          <Badge variant="outline" className="shrink-0">
            Wk {fixture.week}
          </Badge>
        )}
        <span className="font-medium text-foreground">
          {fixture.homeTeamName} vs {fixture.awayTeamName}
        </span>
        {isFinal && (
          <Badge variant="secondary" className="shrink-0">
            Final
          </Badge>
        )}
      </span>
      <span className="flex items-center gap-2">
        <Input
          aria-label={`${fixture.homeTeamName} score`}
          inputMode="numeric"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="h-8 w-14 text-center"
          placeholder="H"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          aria-label={`${fixture.awayTeamName} score`}
          inputMode="numeric"
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="h-8 w-14 text-center"
          placeholder="A"
        />
        <Button size="sm" variant="outline" className="h-8" onClick={submit}>
          {isFinal ? "Update" : "Record"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-muted-foreground hover:text-destructive"
          aria-label="Delete game"
          onClick={() => onDelete(fixture.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </span>
    </li>
  );
}

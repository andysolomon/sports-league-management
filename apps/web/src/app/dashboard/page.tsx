import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getTeams,
  getPlayers,
  getSeasons,
  getDivisions,
  getLeagues,
  listFixturesBySeason,
  listResultsBySeason,
  computeStandings,
  listOrgMemberRoles,
} from "@/lib/data-api";
import { resolveOrgContext, resolveBestOrgRole } from "@/lib/org-context";
import { resolveActiveLeague } from "@/lib/active-league";
import { canManageOrgSettings, roleLabel } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Users,
  UserCircle,
  Calendar,
  Layers,
  CalendarClock,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  BentoCard,
  RadialGauge,
  Sparkline,
  WeekHeatmap,
} from "./_components/bento/bento-widgets";
import { LeagueMap } from "./_components/bento/league-map";

const statCards = [
  { label: "Leagues", href: "/dashboard/leagues", key: "leagues", icon: Trophy },
  { label: "Teams", href: "/dashboard/teams", key: "teams", icon: Users },
  { label: "Players", href: "/dashboard/players", key: "players", icon: UserCircle },
  { label: "Seasons", href: "/dashboard/seasons", key: "seasons", icon: Calendar },
  { label: "Divisions", href: "/dashboard/divisions", key: "divisions", icon: Layers },
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const ids = orgContext.visibleLeagueIds;

  // `leagues` stays org-wide — it feeds the "Leagues" count, the switcher, and
  // active-league resolution. Everything else in the overview is only ever
  // shown for the ACTIVE league (see the league-scoped slices below), so scope
  // those reads to it. Fetching teams/players/etc. across ALL visible leagues
  // can exceed Convex's 8192-element return-array cap — an org with ~19.9k
  // players across its leagues 500'd the whole dashboard (WSM-000189).
  const leagues = await getLeagues(ids);
  const { activeLeagueId } = await resolveActiveLeague(userId);
  const activeLeague =
    leagues.find((l) => l.id === activeLeagueId) ?? leagues[0] ?? null;

  const leagueScope = activeLeague ? [activeLeague.id] : [];
  const [teams, players, seasons, divisions] = await Promise.all([
    getTeams(leagueScope),
    getPlayers(leagueScope),
    getSeasons(leagueScope),
    getDivisions(leagueScope),
  ]);

  // Role-aware bento (WSM-000136 P4): an admin of the active league's org gets
  // an extra org/members widget; coaches & viewers get the team-and-season view.
  const role = await resolveBestOrgRole([activeLeague?.orgId ?? null], userId);
  const isAdmin = canManageOrgSettings(role);
  const memberRoleCounts = { coach: 0, viewer: 0 };
  if (isAdmin && activeLeague?.orgId) {
    for (const r of await listOrgMemberRoles(activeLeague.orgId)) {
      memberRoleCounts[r.role] += 1;
    }
  }

  // League-scoped slices for the bento (P4 is league-wide; coach/team tailoring
  // is a follow-up slice).
  const leagueTeams = activeLeague
    ? teams.filter((t) => t.leagueId === activeLeague.id)
    : [];
  const leagueTeamIds = new Set(leagueTeams.map((t) => t.id));
  const leaguePlayers = players.filter((p) => leagueTeamIds.has(p.teamId));
  const activePlayers = leaguePlayers.filter(
    (p) => p.status.toLowerCase() === "active",
  ).length;
  const rosterCap = leagueTeams.reduce((a, t) => a + (t.rosterLimit ?? 53), 0);

  const leagueSeasons = activeLeague
    ? seasons.filter((s) => s.leagueId === activeLeague.id)
    : [];
  const activeSeason =
    leagueSeasons.find((s) => s.status === "active") ?? leagueSeasons[0] ?? null;

  const leagueDivisions = activeLeague
    ? divisions.filter((d) => d.leagueId === activeLeague.id)
    : [];

  // The quick-nav stat strip is scoped to the SELECTED league, matching the rest
  // of the bento (which is already league-scoped). "Leagues" stays a portfolio-
  // wide total — it's the one count where "all" is meaningful (scoping it would
  // always be 1). Teams/Players/Seasons/Divisions reflect the active league only.
  const counts: Record<string, number> = {
    leagues: leagues.length,
    teams: leagueTeams.length,
    players: leaguePlayers.length,
    seasons: leagueSeasons.length,
    divisions: leagueDivisions.length,
  };

  // Active-season schedule, results and standings (existing wrappers only).
  let fixturesTotal = 0;
  let fixturesFinal = 0;
  let perWeekGames: number[] = [];
  let perWeekPoints: number[] = [];
  let nextKickoff: { label: string; date: string } | null = null;
  let standings: Awaited<ReturnType<typeof computeStandings>> = [];
  let feed: {
    week: number | null;
    home: string;
    away: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
  }[] = [];

  if (activeSeason) {
    // Incident hardening: a single failing season-data read must not crash the
    // whole dashboard. Degrade to empty widgets (defaults initialized above).
    try {
    // One batched read for the whole season instead of one call per fixture
    // (WSM-000193): the old `getResultByFixture` fan-out fired ~one Convex
    // function call per game on every dashboard render.
    const [fixtures, results] = await Promise.all([
      listFixturesBySeason(activeSeason.id),
      listResultsBySeason(activeSeason.id),
    ]);
    const resultByFixture = new Map(
      results.map((r) => [r.fixtureId, r] as const),
    );
    fixturesTotal = fixtures.length;
    fixturesFinal = fixtures.filter((f) => f.status === "final").length;

    const maxWeek = Math.max(0, ...fixtures.map((f) => f.week ?? 0));
    perWeekGames = Array.from(
      { length: maxWeek },
      (_, i) =>
        fixtures.filter((f) => f.week === i + 1 && f.status === "final").length,
    );
    perWeekPoints = Array.from({ length: maxWeek }, (_, i) =>
      fixtures
        .filter((f) => f.week === i + 1)
        .reduce((sum, f) => {
          const r = resultByFixture.get(f.id);
          return sum + (r ? r.homeScore + r.awayScore : 0);
        }, 0),
    );

    const upcoming = fixtures
      .filter((f) => f.status === "scheduled" && f.scheduledAt)
      .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1))[0];
    if (upcoming) {
      nextKickoff = {
        label: `${upcoming.homeTeamName} vs ${upcoming.awayTeamName}`,
        date: formatDate(upcoming.scheduledAt!),
      };
    }

    standings = (await computeStandings(activeSeason.id)).slice(0, 5);

    feed = fixtures
      .filter((f) => f.status === "final")
      .map((f) => ({ f, r: resultByFixture.get(f.id) }))
      .filter((x) => x.r)
      .sort((a, b) => (b.f.week ?? 0) - (a.f.week ?? 0))
      .slice(0, 6)
      .map((x) => ({
        week: x.f.week,
        home: x.f.homeTeamName,
        away: x.f.awayTeamName,
        homeTeamId: x.f.homeTeamId,
        awayTeamId: x.f.awayTeamId,
        homeScore: x.r!.homeScore,
        awayScore: x.r!.awayScore,
      }));
    } catch (err) {
      console.error("dashboard: season widgets failed to load", err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Overview</h2>
        {activeLeague && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <span className="font-medium text-foreground">
              {activeLeague.name}
            </span>
            {activeSeason && <Badge variant="secondary">{activeSeason.name}</Badge>}
            {role && <Badge variant="outline">{roleLabel(role)}</Badge>}
          </div>
        )}
      </div>

      {/* Quick-nav stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.key} href={card.href}>
              <Card className="transition-colors hover:border-primary">
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-caption-12 uppercase tracking-wide text-text-muted">
                      {card.label}
                    </p>
                    <p className="text-stat-30 font-mono tabular-nums text-foreground">
                      {counts[card.key]}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {leagues.length === 0 ? (
        <BentoCard className="items-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No leagues yet. Add teams from{" "}
            <Link href="/dashboard/discover" className="text-primary hover:underline">
              Discover
            </Link>{" "}
            or{" "}
            <Link href="/dashboard/import" className="text-primary hover:underline">
              import
            </Link>{" "}
            a roster to get started.
          </p>
        </BentoCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* Hero */}
          <BentoCard title="This league" className="lg:col-span-2">
            <div className="flex flex-1 flex-col justify-between gap-4">
              <div>
                <p className="text-title-22 text-foreground">
                  <Link
                    href={`/dashboard/leagues/${activeLeague!.id}`}
                    className="hover:underline"
                  >
                    {activeLeague!.name}
                  </Link>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {leagueTeams.length} team{leagueTeams.length === 1 ? "" : "s"} ·{" "}
                  {leaguePlayers.length} player
                  {leaguePlayers.length === 1 ? "" : "s"} ·{" "}
                  {activeSeason ? activeSeason.name : "no active season"}
                </p>
              </div>
              {nextKickoff ? (
                <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Next:</span>
                  <span className="font-medium text-foreground">
                    {nextKickoff.label}
                  </span>
                  <span className="ml-auto font-mono text-muted-foreground">
                    {nextKickoff.date}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No upcoming games scheduled.
                </p>
              )}
            </div>
          </BentoCard>

          {/* Season health gauges */}
          <BentoCard title="Season health" className="lg:col-span-2">
            <div className="flex flex-1 items-center justify-around gap-4">
              <RadialGauge
                value={activePlayers}
                max={rosterCap}
                caption="Roster fill"
              />
              <RadialGauge
                value={fixturesFinal}
                max={fixturesTotal}
                caption="Schedule played"
              />
            </div>
          </BentoCard>

          {/* Admin-only: org & members */}
          {isAdmin && (
            <BentoCard
              title="League admin"
              className="lg:col-span-4"
              action={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {memberRoleCounts.coach}
                  </span>{" "}
                  coach{memberRoleCounts.coach === 1 ? "" : "es"} ·{" "}
                  <span className="font-medium text-foreground">
                    {memberRoleCounts.viewer}
                  </span>{" "}
                  viewer{memberRoleCounts.viewer === 1 ? "" : "s"} assigned. New
                  members default to viewer.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/leagues/${activeLeague!.id}/members`}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary"
                  >
                    Members
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/dashboard/roles"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary"
                  >
                    Roles & permissions
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </BentoCard>
          )}

          {/* Standings */}
          <BentoCard
            title="Standings"
            className="lg:col-span-2"
            action={
              activeSeason ? (
                <Link
                  href={`/dashboard/leagues/${activeLeague!.id}/standings`}
                  className="text-xs text-primary hover:underline"
                >
                  View all
                </Link>
              ) : undefined
            }
          >
            {standings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No standings yet — record some game results.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {standings.map((s) => (
                  <li
                    key={s.teamId}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-5 text-right font-mono text-muted-foreground">
                      {s.leagueRank}
                    </span>
                    <Link
                      href={`/dashboard/teams/${s.teamId}`}
                      className="flex-1 truncate font-medium text-foreground hover:underline"
                    >
                      {s.teamName}
                    </Link>
                    <span className="font-mono text-muted-foreground">
                      {s.wins}-{s.losses}
                      {s.ties ? `-${s.ties}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </BentoCard>

          {/* Activity feed */}
          <BentoCard title="Recent results" className="lg:col-span-2">
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No games recorded yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {feed.map((g, i) => {
                  const homeWon = g.homeScore > g.awayScore;
                  const awayWon = g.awayScore > g.homeScore;
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {g.week !== null && (
                        <Badge variant="outline" className="shrink-0">
                          Wk {g.week}
                        </Badge>
                      )}
                      <Link
                        href={`/dashboard/teams/${g.homeTeamId}`}
                        className={
                          homeWon
                            ? "font-semibold text-foreground hover:underline"
                            : "text-muted-foreground hover:underline"
                        }
                      >
                        {g.home}
                      </Link>
                      <span className="font-mono text-muted-foreground">
                        {g.homeScore}–{g.awayScore}
                      </span>
                      <Link
                        href={`/dashboard/teams/${g.awayTeamId}`}
                        className={
                          awayWon
                            ? "font-semibold text-foreground hover:underline"
                            : "text-muted-foreground hover:underline"
                        }
                      >
                        {g.away}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </BentoCard>

          {/* Sparkline */}
          <BentoCard title="Scoring by week" className="lg:col-span-2">
            <Sparkline values={perWeekPoints} />
            <p className="mt-2 text-xs text-muted-foreground">
              Total points scored each week.
            </p>
          </BentoCard>

          {/* Heatmap */}
          <BentoCard title="Games played by week" className="lg:col-span-2">
            <WeekHeatmap counts={perWeekGames} />
          </BentoCard>

          {/* League geography */}
          <BentoCard title="Where your teams are" className="lg:col-span-4">
            <LeagueMap teams={leagueTeams} />
          </BentoCard>
        </div>
      )}
    </div>
  );
}

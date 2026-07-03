import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Radio } from "lucide-react";
import {
  schedulesStandingsV1,
  liveStreamingV1,
  statKeepingV1,
  liveScoringV1,
  playoffsV1,
  syntheticRostersV1,
} from "@/lib/flags";
import {
  getLeague,
  getLeagueOrgId,
  getSeasons,
  getResultByFixture,
  getStreamByFixture,
  getTeamsByLeague,
  listFixturesBySeason,
  type PublicGameStream,
} from "@/lib/data-api";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageRoster, canManageOrgSettings } from "@/lib/permissions";
import { formatFixtureWhen } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FixtureFormDialog from "@/components/schedule/FixtureFormDialog";
import GenerateScheduleButton from "@/components/schedule/GenerateScheduleButton";
import RecordResultDialog from "@/components/schedule/RecordResultDialog";
import DeleteFixtureButton from "@/components/schedule/DeleteFixtureButton";
import GoLiveControl from "@/components/schedule/GoLiveControl";
import ClipsControl from "@/components/schedule/ClipsControl";
import {
  SimulateGameButton,
  SimulateSeasonButton,
  SimulateChampionButton,
} from "@/components/schedule/SimulateControls";
import { SyntheticRosterButton } from "@/components/roster/SyntheticRosterButton";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

type StreamStatus = "idle" | "active" | "ended";

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
  // Live streaming is a dark flag (default OFF everywhere). The "Go live"
  // control is admin-only — it maps to the action's `canAdministerTeam` gate, so
  // coaches (who can manage rosters but not administer) never see a button that
  // would just 403.
  const streamingEnabled = await liveStreamingV1();
  const canStream = streamingEnabled && canManageOrgSettings(role);
  // Box-score entry (WSM-000112): a league admin/coach can enter either team's
  // stats; the entry page re-checks canManageTeam for the specific team.
  const statsEnabled = await statKeepingV1();
  // Live scoring (WSM-000152): operator-driven running scoreboard. Same
  // admin/coach surface as stats; the live page re-checks canManageTeam.
  const liveEnabled = await liveScoringV1();
  // Playoffs (WSM-000164/165): bracket lives on its own page; link when enabled.
  const playoffsEnabled = await playoffsV1();
  // Synthetic rosters (WSM-000173): discoverability shortcut — admins setting up
  // a schedule often need rosters first. Same admin + flag gate as the league
  // detail page; the server actions re-check flag + role.
  const canGenerateRosters = canManageOrgSettings(role) && (await syntheticRostersV1());

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

  // Per-fixture live-stream state — only fetched when the dark flag is on for
  // an admin, so the default (flag off) path adds zero reads. The full public
  // projection is kept (not just status): the clips control (WSM-000201)
  // needs vodAssetId/vodPlaybackId to know a recording exists.
  const streams = new Map<string, PublicGameStream | null>();
  if (canStream) {
    await Promise.all(
      fixtures.map(async (f) => {
        streams.set(f.id, await getStreamByFixture(f.id));
      }),
    );
  }

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

      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{league.name}</h2>
          <p className="text-sm text-muted-foreground">
            Schedule {activeSeason ? `· ${activeSeason.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/leagues/${leagueId}/standings`}
            className="text-sm text-primary hover:underline"
          >
            Standings &rarr;
          </Link>
          {playoffsEnabled ? (
            <Link
              href={`/dashboard/leagues/${leagueId}/playoffs`}
              className="text-sm text-primary hover:underline"
            >
              Playoffs &rarr;
            </Link>
          ) : null}
          {isAdmin && activeSeason && teams.length >= 2 ? (
            <GenerateScheduleButton
              leagueId={leagueId}
              seasonId={activeSeason.id}
              seasonName={activeSeason.name}
              hasFixtures={fixtures.length > 0}
            />
          ) : null}
          {isAdmin && activeSeason ? (
            <FixtureFormDialog
              leagueId={leagueId}
              seasonId={activeSeason.id}
              teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            />
          ) : null}
          {isAdmin && activeSeason && fixtures.length > 0 ? (
            <>
              <SimulateSeasonButton
                leagueId={leagueId}
                seasonId={activeSeason.id}
              />
              <SimulateChampionButton
                leagueId={leagueId}
                seasonId={activeSeason.id}
              />
            </>
          ) : null}
          {canGenerateRosters ? (
            <>
              <SyntheticRosterButton kind="league" id={leagueId} />
              <SyntheticRosterButton
                kind="league"
                id={leagueId}
                action="attributes"
              />
            </>
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
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
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
                            {formatFixtureWhen(fixture.scheduledAt)}
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
                          <td className="px-4 py-2">
                            <StatusBadge status={fixture.status} />
                          </td>
                          {isAdmin ? (
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap items-center gap-1">
                                <RecordResultDialog
                                  leagueId={leagueId}
                                  fixtureId={fixture.id}
                                  homeTeamName={fixture.homeTeamName}
                                  awayTeamName={fixture.awayTeamName}
                                  initialHomeScore={result?.homeScore ?? null}
                                  initialAwayScore={result?.awayScore ?? null}
                                  triggerLabel={result ? "Edit result" : "Record result"}
                                />
                                {fixture.status === "scheduled" ? (
                                  <SimulateGameButton
                                    leagueId={leagueId}
                                    fixtureId={fixture.id}
                                    homeTeamName={fixture.homeTeamName}
                                    awayTeamName={fixture.awayTeamName}
                                  />
                                ) : null}
                                <DeleteFixtureButton
                                  leagueId={leagueId}
                                  fixtureId={fixture.id}
                                  homeTeamName={fixture.homeTeamName}
                                  awayTeamName={fixture.awayTeamName}
                                />
                                {canStream ? (
                                  <GoLiveControl
                                    leagueId={leagueId}
                                    fixtureId={fixture.id}
                                    homeTeamName={fixture.homeTeamName}
                                    awayTeamName={fixture.awayTeamName}
                                    status={
                                      (streams.get(fixture.id)?.status as
                                        | StreamStatus
                                        | undefined) ?? null
                                    }
                                    gameStatus={fixture.status}
                                  />
                                ) : null}
                                {canStream &&
                                streams.get(fixture.id)?.provider === "mux" &&
                                streams.get(fixture.id)?.vodAssetId ? (
                                  <ClipsControl
                                    leagueId={leagueId}
                                    fixtureId={fixture.id}
                                    homeTeamName={fixture.homeTeamName}
                                    awayTeamName={fixture.awayTeamName}
                                    vodPlaybackId={
                                      streams.get(fixture.id)?.vodPlaybackId ??
                                      null
                                    }
                                  />
                                ) : null}
                                {statsEnabled ? (
                                  <span className="flex items-center gap-1 text-xs">
                                    <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                                    <Link
                                      href={`/dashboard/teams/${fixture.homeTeamId}/games/${fixture.id}/stats`}
                                      className="text-primary hover:underline"
                                    >
                                      {fixture.homeTeamName}
                                    </Link>
                                    <span className="text-muted-foreground">/</span>
                                    <Link
                                      href={`/dashboard/teams/${fixture.awayTeamId}/games/${fixture.id}/stats`}
                                      className="text-primary hover:underline"
                                    >
                                      {fixture.awayTeamName}
                                    </Link>
                                  </span>
                                ) : null}
                                {liveEnabled ? (
                                  <span className="flex items-center gap-1 text-xs">
                                    <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                                    <Link
                                      href={`/dashboard/teams/${fixture.homeTeamId}/games/${fixture.id}/live`}
                                      className="text-primary hover:underline"
                                    >
                                      {fixture.homeTeamName}
                                    </Link>
                                    <span className="text-muted-foreground">/</span>
                                    <Link
                                      href={`/dashboard/teams/${fixture.awayTeamId}/games/${fixture.id}/live`}
                                      className="text-primary hover:underline"
                                    >
                                      {fixture.awayTeamName}
                                    </Link>
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
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
  getGamePlayLog,
  getPlayoffBracket,
  getTeamsByLeague,
  getPlayers,
  listFixturesBySeason,
  computeStandings,
  type PublicGameStream,
} from "@/lib/data-api";
import {
  formatTeamRecord,
  projectionFromFixture,
} from "@/lib/game-drawer-projection";
import type {
  FixtureDto,
  GameResultDto,
} from "@sports-management/shared-types";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageRoster, canManageOrgSettings } from "@/lib/permissions";
import { isSeasonStarted } from "@/lib/season-started";
import { regularSeasonProgress } from "@/lib/playoffs";
import { resolvePlayoffHandoff } from "@/lib/playoff-handoff";
import {
  groupFixturesByWeek,
  initialOpenWeekKeys,
} from "@/lib/schedule-weeks";
import { Card, CardContent } from "@/components/ui/card";
import FixtureFormDialog from "@/components/schedule/FixtureFormDialog";
import GenerateScheduleButton from "@/components/schedule/GenerateScheduleButton";
import {
  SimulateScopeMenu,
  SimulateWeekButton,
} from "@/components/schedule/SimulateControls";
import ScheduleWeeks, {
  type ScheduleWeekView,
} from "@/components/schedule/ScheduleWeeks";
import { ScheduleFixtureRow } from "@/components/schedule/ScheduleFixtureRow";
import AdvanceToPlayoffsButton from "@/components/playoffs/AdvanceToPlayoffsButton";
import { SyntheticRosterButton } from "@/components/roster/SyntheticRosterButton";
import { UndersizedRosterPanel } from "@/components/roster/UndersizedRosterPanel";
import {
  activeRosterCountByTeam,
  buildLeagueRosterDeficitProjection,
} from "@/lib/roster-deficit";
import { DEFAULT_TARGET_ROSTER_SIZE } from "@/lib/offseason-activate";
import { Button } from "@/components/ui/button";
import SeasonSwitcher from "@/components/schedule/SeasonSwitcher";
import { resolveLifecycleSeason, resolveViewedSeason } from "@/lib/season-view";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";
import { BackLink } from "@/components/workspace/BackLink";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "@/components/workspace/build-league-nav-links";

interface FixtureRow {
  fixture: FixtureDto;
  result: GameResultDto | null;
  hasPlayLog: boolean;
}

export default async function LeagueSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
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
  const statsNavEnabled = await statKeepingV1();
  // Synthetic rosters (WSM-000173): discoverability shortcut — admins setting up
  // a schedule often need rosters first. Same admin + flag gate as the league
  // detail page; the server actions re-check flag + role.
  const rosterGenEnabled = canManageOrgSettings(role) && (await syntheticRostersV1());

  // Season being VIEWED (WSM-000214): `?season=` wins, else active, else first.
  const { season: seasonParam } = await searchParams;
  const allSeasons = await getSeasons([leagueId]);
  const activeSeason = resolveViewedSeason(allSeasons, seasonParam);

  // Completed seasons are read-only history (WSM-000238/239): every mutation
  // control disappears; results, Gamecast links, and clips annotation remain.
  const seasonCompleted = activeSeason?.status === "completed";
  const canMutate = isAdmin && !seasonCompleted;
  const canGoLive = canStream && !seasonCompleted;
  const canGenerateRosters = rosterGenEnabled && !seasonCompleted;

  const teams = await getTeamsByLeague(leagueId, orgContext);
  const leaguePlayers = canGenerateRosters
    ? await getPlayers([leagueId]).catch(() => [])
    : [];
  const rosterDeficit = canGenerateRosters
    ? buildLeagueRosterDeficitProjection(
        teams,
        activeRosterCountByTeam(leaguePlayers),
      )
    : { target: DEFAULT_TARGET_ROSTER_SIZE, teams: [] };

  const fixtures = activeSeason
    ? await listFixturesBySeason(activeSeason.id)
    : [];

  const seasonStarted = activeSeason
    ? isSeasonStarted(activeSeason, fixtures)
    : false;

  // Hydrate per-fixture result for "Record result" pre-fill + score display.
  const fixturesWithResults: FixtureRow[] = await Promise.all(
    fixtures.map(async (f) => {
      const result =
        f.status === "final" ? await getResultByFixture(f.id) : null;
      const hasPlayLog =
        f.status === "final" ? (await getGamePlayLog(f.id)) !== null : false;
      return { fixture: f, result, hasPlayLog };
    }),
  );

  const standings = activeSeason
    ? await computeStandings(activeSeason.id)
    : [];
  const recordByTeamId = new Map(
    standings.map((s) => [
      s.teamId,
      formatTeamRecord(s.wins, s.losses, s.ties),
    ]),
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

  // Playoff handoff (WSM-000239): the schedule page offers "Start playoffs"
  // the moment the DECIDED active season's regular slate is done and no
  // bracket exists yet. Bracket lookup only runs when the cheap pure checks
  // could possibly surface the panel.
  const decidedSeason = resolveLifecycleSeason(allSeasons);
  const progress = regularSeasonProgress(fixtures);
  const bracket =
    playoffsEnabled &&
    activeSeason &&
    activeSeason.id === decidedSeason?.id &&
    progress.total > 0 &&
    progress.complete
      ? await getPlayoffBracket(activeSeason.id).catch(() => null)
      : null;
  const handoff = resolvePlayoffHandoff({
    playoffsEnabled,
    viewedSeasonId: activeSeason?.id ?? null,
    viewedSeasonStatus: activeSeason?.status ?? null,
    decidedSeasonId: decidedSeason?.id ?? null,
    playoffTeams: activeSeason?.playoffTeams,
    regularTotal: progress.total,
    regularComplete: progress.complete,
    bracketExists: bracket !== null,
    canManage: isAdmin,
  });

  // Lifecycle accordion timeline (WSM-000239): weeks grouped and classified by
  // the pure helper; completed weeks start collapsed, mixed weeks split their
  // finished games into a nested subsection. The client component receives
  // fully-rendered table slots — all fetching stays here on the server.
  const weekGroups = groupFixturesByWeek(fixturesWithResults, (r) => r.fixture);
  const fixtureTable = (rows: FixtureRow[]) => (
    <FixtureTable
      rows={rows}
      leagueId={leagueId}
      isAdmin={isAdmin}
      canMutate={canMutate}
      canGoLive={canGoLive}
      canStream={canStream}
      statsEnabled={statsEnabled}
      liveEnabled={liveEnabled}
      streams={streams}
      recordByTeamId={recordByTeamId}
    />
  );
  const weekViews: ScheduleWeekView[] = weekGroups.map((group) => ({
    key: group.key,
    label: group.label,
    status: group.status,
    // "completed", not "final" — completedRows also counts cancelled games.
    summary: `${group.completedRows.length} of ${group.rows.length} completed`,
    actions:
      canMutate &&
      activeSeason &&
      group.week !== null &&
      group.rows.some(({ fixture }) => fixture.status === "scheduled") ? (
        <SimulateWeekButton
          leagueId={leagueId}
          seasonId={activeSeason.id}
          week={group.week}
        />
      ) : undefined,
    content:
      group.status === "mixed"
        ? fixtureTable(group.remainingRows)
        : fixtureTable(group.rows),
    completedContent:
      group.status === "mixed" ? fixtureTable(group.completedRows) : undefined,
    completedCount: group.completedRows.length,
  }));
  const initialOpenKeys = initialOpenWeekKeys(weekGroups);

  const peerNavLinks = buildLeagueSeasonNavLinks({
    leagueId,
    seasonId: activeSeason?.id ?? null,
    scheduleEnabled: enabled,
    playoffsEnabled,
    statsEnabled: statsNavEnabled,
    exclude: "schedule",
  });

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leagues", href: "/dashboard/leagues" },
          { label: league.name, href: `/dashboard/leagues/${leagueId}` },
          { label: "Schedule" },
        ]}
      />
      <BackLink
        href={`/dashboard/leagues/${leagueId}`}
        label="Back to League"
      />
      <WorkspaceHeader
        title={league.name}
        size="sub-hub"
        sub={`Schedule${activeSeason ? ` · ${activeSeason.name}` : ""}`}
        actions={
          <>
            {activeSeason ? (
              <SeasonSwitcher
                seasons={allSeasons.map((s) => ({
                  id: s.id,
                  name: s.name,
                  status: s.status,
                }))}
                currentSeasonId={activeSeason.id}
              />
            ) : null}
            {canMutate && activeSeason && teams.length >= 2 ? (
              <GenerateScheduleButton
                leagueId={leagueId}
                seasonId={activeSeason.id}
                seasonName={activeSeason.name}
                hasFixtures={fixtures.length > 0}
              />
            ) : null}
            {canMutate && activeSeason ? (
              <FixtureFormDialog
                leagueId={leagueId}
                seasonId={activeSeason.id}
                teams={teams.map((t) => ({ id: t.id, name: t.name }))}
              />
            ) : null}
            {canMutate && activeSeason && fixtures.length > 0 ? (
              <SimulateScopeMenu
                leagueId={leagueId}
                seasonId={activeSeason.id}
                playoffFormat={
                  bracket?.format ?? activeSeason.playoffFormat ?? "single"
                }
              />
            ) : null}
            {canGenerateRosters ? (
              <>
                <SyntheticRosterButton
                  kind="league"
                  id={leagueId}
                  seasonStarted={seasonStarted}
                />
                <SyntheticRosterButton
                  kind="league"
                  id={leagueId}
                  action="attributes"
                  seasonStarted={seasonStarted}
                />
              </>
            ) : null}
          </>
        }
      />
      <WorkspaceNav links={peerNavLinks} />

      {canGenerateRosters && rosterDeficit.teams.length > 0 ? (
        <div className="mb-6">
          <UndersizedRosterPanel
            leagueId={leagueId}
            target={rosterDeficit.target}
            undersizedTeams={rosterDeficit.teams}
            canAutoFill={!seasonStarted}
          />
        </div>
      ) : null}

      {handoff !== "hidden" && activeSeason ? (
        <Card className="mb-6" data-testid="playoff-handoff">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Regular season complete ({progress.final} of {progress.total}{" "}
              games final).
            </p>
            {handoff === "start" ? (
              <AdvanceToPlayoffsButton
                leagueId={leagueId}
                seasonId={activeSeason.id}
                triggerLabel="Start playoffs"
              />
            ) : (
              <p className="text-sm text-foreground">
                Regular season complete — waiting for playoffs to start.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

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
      ) : weekViews.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No fixtures scheduled yet for {activeSeason.name}.
          </CardContent>
        </Card>
      ) : (
        <ScheduleWeeks weeks={weekViews} initialOpenKeys={initialOpenKeys} />
      )}
    </div>
  );
}

/*
 * One week's fixture table — server-rendered and handed to the client
 * accordion as a slot. `isAdmin` keeps the Actions column (read links, clips)
 * for managers even on completed seasons; `canMutate` gates every control
 * that would change the season; `canGoLive` gates stream creation.
 */
function FixtureTable({
  rows,
  leagueId,
  isAdmin,
  canMutate,
  canGoLive,
  canStream,
  statsEnabled,
  liveEnabled,
  streams,
  recordByTeamId,
}: {
  rows: FixtureRow[];
  leagueId: string;
  isAdmin: boolean;
  canMutate: boolean;
  canGoLive: boolean;
  canStream: boolean;
  statsEnabled: boolean;
  liveEnabled: boolean;
  streams: Map<string, PublicGameStream | null>;
  recordByTeamId: Map<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b-2 border-border bg-muted text-left text-foreground">
            <th className="px-4 py-2 font-mono text-xs uppercase">When</th>
            <th className="px-4 py-2 font-mono text-xs uppercase">Home</th>
            <th className="px-4 py-2 font-mono text-xs uppercase">Away</th>
            <th className="px-4 py-2 text-right font-mono text-xs uppercase">
              Score
            </th>
            <th className="px-4 py-2 font-mono text-xs uppercase">Status</th>
            {isAdmin ? (
              <th className="px-4 py-2 font-mono text-xs uppercase">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ fixture, result, hasPlayLog }) => (
            <ScheduleFixtureRow
              key={fixture.id}
              fixture={fixture}
              result={result}
              hasPlayLog={hasPlayLog}
              projection={projectionFromFixture({
                fixture,
                result,
                hasPlayLog,
                recordByTeamId,
              })}
              leagueId={leagueId}
              isAdmin={isAdmin}
              canMutate={canMutate}
              canGoLive={canGoLive}
              canStream={canStream}
              statsEnabled={statsEnabled}
              liveEnabled={liveEnabled}
              stream={streams.get(fixture.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

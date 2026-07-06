import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { schedulesStandingsV1 } from "@/lib/flags";
import {
  getFixture,
  getGamePlayLog,
  getLeague,
  getSeasonLeagueId,
  getSeasons,
  listFixturesBySeason,
  getPlayoffBracket,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { PBP_ENGINE_VERSION } from "@/lib/pbp";
import { parseGamePlayLog } from "@/lib/gamecast/parse-log";
import {
  seasonDecidedContext,
  shouldShowDynastyCta,
} from "@/lib/dynasty-panel";
import GamecastView from "@/components/gamecast/GamecastView";
import GamecastEmptyState from "@/components/gamecast/GamecastEmptyState";
import { getTeam } from "@/lib/data-api";

export default async function GamecastPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const enabled = await schedulesStandingsV1();
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

  const seasons = await getSeasons([leagueId]).catch(() => []);
  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const upcomingSeason = seasons.find((s) => s.status === "upcoming") ?? null;
  const [seasonFixtures, bracket] = await Promise.all([
    activeSeason
      ? listFixturesBySeason(activeSeason.id).catch(() => [])
      : Promise.resolve([]),
    activeSeason
      ? getPlayoffBracket(activeSeason.id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const decidedCtx = activeSeason
    ? seasonDecidedContext(seasonFixtures, bracket)
    : { seasonDecided: false };
  const showDynastyCta = shouldShowDynastyCta({
    gameFinal: fixture.status === "final",
    seasonDecided: decidedCtx.seasonDecided,
    upcomingSeasonExists: Boolean(upcomingSeason),
  });
  const dynastyCta = showDynastyCta ? { leagueId } : null;

  const row = await getGamePlayLog(fixtureId);
  const log = row ? parseGamePlayLog(row.logJson) : null;

  let body: ReactNode;
  if (!row) {
    body = <GamecastEmptyState leagueId={leagueId} reason="no_log" />;
  } else if (!log) {
    body = <GamecastEmptyState leagueId={leagueId} reason="parse_error" />;
  } else {
    const [homeTeam, awayTeam] = await Promise.all([
      getTeam(fixture.homeTeamId, orgContext).catch(() => null),
      getTeam(fixture.awayTeamId, orgContext).catch(() => null),
    ]);
    const weekLabel =
      fixture.week !== null ? `Week ${fixture.week}` : null;
    body = (
      <GamecastView
        log={log}
        homeTeamName={fixture.homeTeamName}
        awayTeamName={fixture.awayTeamName}
        homePrimaryColor={homeTeam?.primaryColor}
        awayPrimaryColor={awayTeam?.primaryColor}
        weekLabel={weekLabel}
        engineVersionMismatch={row.engineVersion !== PBP_ENGINE_VERSION}
        storedEngineVersion={row.engineVersion}
        currentEngineVersion={PBP_ENGINE_VERSION}
        dynastyCta={dynastyCta}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/dashboard/leagues/${leagueId}/schedule`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Schedule
      </Link>

      <header className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Gamecast</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {fixture.homeTeamName} vs {fixture.awayTeamName}
          {fixture.week !== null ? ` · Week ${fixture.week}` : ""}
        </p>
      </header>

      {body}
    </div>
  );
}

import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { playoffsV1 } from "@/lib/flags";
import {
  getLeague,
  getLeagueOrgId,
  getSeasons,
  getPlayoffBracket,
  listFixturesBySeason,
} from "@/lib/data-api";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import { playoffPagePhase, regularSeasonProgress } from "@/lib/playoffs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PlayoffBracket from "@/components/playoffs/PlayoffBracket";
import AdvanceToPlayoffsButton from "@/components/playoffs/AdvanceToPlayoffsButton";
import SeasonSwitcher from "@/components/schedule/SeasonSwitcher";
import { resolveViewedSeason } from "@/lib/season-view";

export default async function LeaguePlayoffsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const enabled = await playoffsV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: leagueId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) notFound();

  const orgId = await getLeagueOrgId(leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  const isAdmin = canManageRoster(role);

  const { season: seasonParam } = await searchParams;
  const allSeasons = await getSeasons([leagueId]);
  const activeSeason = resolveViewedSeason(allSeasons, seasonParam);

  const fixtures = activeSeason
    ? await listFixturesBySeason(activeSeason.id)
    : [];
  const progress = regularSeasonProgress(fixtures);

  const bracket = activeSeason
    ? await getPlayoffBracket(activeSeason.id)
    : null;

  const phase = activeSeason
    ? playoffPagePhase({
        playoffTeams: activeSeason.playoffTeams,
        bracketExists: bracket !== null,
        regularComplete: progress.complete,
      })
    : null;

  return (
    <div>
      <Link
        href={`/dashboard/leagues/${leagueId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to League
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{league.name}</h2>
          <p className="text-sm text-muted-foreground">
            Playoffs {activeSeason ? `· ${activeSeason.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Link
            href={`/dashboard/leagues/${leagueId}/schedule`}
            className="text-sm text-primary hover:underline"
          >
            &larr; Schedule
          </Link>
          <Link
            href={`/dashboard/leagues/${leagueId}/standings`}
            className="text-sm text-primary hover:underline"
          >
            Standings &rarr;
          </Link>
        </div>
      </header>

      {!activeSeason ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Playoffs need a season. Create one and play some games so standings
              can seed the bracket.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/seasons">Go to Seasons</Link>
            </Button>
          </CardContent>
        </Card>
      ) : phase === "no_playoffs_config" ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {activeSeason.name} is not configured for playoffs. Set a playoff team
            count on the season to enable the bracket.
          </CardContent>
        </Card>
      ) : phase === "bracket_live" && bracket ? (
        <PlayoffBracket bracket={bracket} />
      ) : phase === "ready" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Regular season complete ({progress.final} of {progress.total} games
              final). Ready to seed the bracket from current standings.
            </p>
            {isAdmin ? (
              <AdvanceToPlayoffsButton leagueId={leagueId} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Waiting for a league manager to advance to playoffs.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Regular season in progress — {progress.final} of {progress.total}{" "}
              games final.
            </p>
            {isAdmin ? (
              <AdvanceToPlayoffsButton leagueId={leagueId} disabled />
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

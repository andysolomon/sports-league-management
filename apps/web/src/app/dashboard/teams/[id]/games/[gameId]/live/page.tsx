import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { liveScoringV1 } from "@/lib/flags";
import { getTeam, getFixture, getLiveGameState } from "@/lib/data-api";
import { canManageTeam } from "@/lib/authorization";
import { resolveOrgContext } from "@/lib/org-context";
import LiveScoreboard from "@/components/live/LiveScoreboard";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function LiveScoreboardPage({
  params,
}: {
  params: Promise<{ id: string; gameId: string }>;
}) {
  const enabled = await liveScoringV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: teamId, gameId } = await params;

  // Owner-edits-only: must manage this team (coach/admin of its league/owner org).
  if (!(await canManageTeam(teamId, userId))) notFound();

  const orgContext = await resolveOrgContext(userId);
  const [team, fixture] = await Promise.all([
    getTeam(teamId, orgContext).catch(() => null),
    getFixture(gameId),
  ]);
  if (!team || !fixture) notFound();
  // The team must actually be in this game.
  if (fixture.homeTeamId !== teamId && fixture.awayTeamId !== teamId) notFound();
  await syncActiveLeagueForResource(team.leagueId);

  const initial = await getLiveGameState(gameId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/dashboard/leagues/${team.leagueId}/schedule`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Schedule
      </Link>

      <header className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Live scoreboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {fixture.homeTeamName} vs {fixture.awayTeamName}
          {fixture.week !== null ? ` · Week ${fixture.week}` : ""}
        </p>
      </header>

      <LiveScoreboard
        teamId={teamId}
        fixtureId={gameId}
        homeTeamName={fixture.homeTeamName}
        awayTeamName={fixture.awayTeamName}
        initial={initial}
      />
    </div>
  );
}

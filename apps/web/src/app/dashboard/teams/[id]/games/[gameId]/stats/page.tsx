import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { PlayerGameStatLine } from "@sports-management/shared-types";
import { statKeepingV1 } from "@/lib/flags";
import {
  getTeam,
  getFixture,
  getPlayersByTeam,
  getPlayerGameStatsByFixture,
} from "@/lib/data-api";
import { canManageTeam } from "@/lib/authorization";
import { resolveOrgContext } from "@/lib/org-context";
import StatsEntry from "@/components/stats/StatsEntry";

export default async function StatsEntryPage({
  params,
}: {
  params: Promise<{ id: string; gameId: string }>;
}) {
  const enabled = await statKeepingV1();
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

  const players = await getPlayersByTeam(teamId, orgContext);
  const entered = (await getPlayerGameStatsByFixture(gameId)).filter(
    (s) => s.teamId === teamId,
  );
  const initial: Record<string, PlayerGameStatLine> = {};
  for (const s of entered) initial[s.playerId] = s.stats;

  const opponent =
    fixture.homeTeamId === teamId
      ? fixture.awayTeamName
      : fixture.homeTeamName;
  const homeAway = fixture.homeTeamId === teamId ? "vs" : "at";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/dashboard/leagues/${team.leagueId}/schedule`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Schedule
      </Link>

      <header className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Enter stats</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {team.name} {homeAway} {opponent}
          {fixture.week !== null ? ` · Week ${fixture.week}` : ""}
        </p>
      </header>

      <StatsEntry
        teamId={teamId}
        fixtureId={gameId}
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          positionGroup: p.positionGroup,
          jerseyNumber: p.jerseyNumber,
        }))}
        initial={initial}
      />
    </div>
  );
}

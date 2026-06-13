import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { playersInScope } from "@/lib/subscription-scope";
import { PlayersTable } from "./players-table";

export default async function PlayersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Active league (WSM-000103), then à la carte imported teams within it
  // (WSM-000100): a partial import shows only players on the imported teams.
  const { orgContext, activeLeagueId } = await resolveActiveLeague(userId);
  const players = activeLeagueId
    ? playersInScope(
        await getPlayers([activeLeagueId]),
        activeLeagueId,
        orgContext,
      )
    : [];

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Players</h2>
      <PlayersTable players={players} />
    </div>
  );
}

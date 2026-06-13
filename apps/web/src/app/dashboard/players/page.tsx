import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { PlayersTable } from "./players-table";

export default async function PlayersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Scoped to the active league from the global switcher (WSM-000103) — the
  // flat all-leagues dump is gone; the switcher is the league picker now.
  const { activeLeagueId } = await resolveActiveLeague(userId);
  const players = activeLeagueId ? await getPlayers([activeLeagueId]) : [];

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Players</h2>
      <PlayersTable players={players} />
    </div>
  );
}

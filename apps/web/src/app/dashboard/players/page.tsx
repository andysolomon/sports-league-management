import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { PlayersTable } from "./players-table";
import { PageHeader } from "../_components/page-header";

export default async function PlayersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Active league (WSM-000103).
  const { activeLeagueId } = await resolveActiveLeague(userId);
  const players = activeLeagueId ? await getPlayers([activeLeagueId]) : [];

  return (
    <div>
      <PageHeader title="Players" description="All players on rosters in the active league." />
      <PlayersTable players={players} />
    </div>
  );
}

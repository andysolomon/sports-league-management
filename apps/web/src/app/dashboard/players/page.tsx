import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { PlayersTable } from "./players-table";

export default async function PlayersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const players = await getPlayers(orgContext.visibleLeagueIds);

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Players</h2>
      <PlayersTable players={players} />
    </div>
  );
}

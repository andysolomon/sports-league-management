import { getPlayers } from "@/lib/salesforce-api";
import { PlayersTable } from "./players-table";

export default async function PlayersPage() {
  const players = await getPlayers();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Players</h2>
      <PlayersTable players={players} />
    </div>
  );
}

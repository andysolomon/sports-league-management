import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getPlayers,
  getTeams,
  getSeasons,
  listSeasonPlayerAttributes,
} from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { playerAttributesV1 } from "@/lib/flags";
import type { DirectoryPlayer } from "@/lib/players-directory";
import { PlayersTable } from "./players-table";
import { PageHeader } from "../_components/page-header";

export default async function PlayersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { activeLeagueId } = await resolveActiveLeague(userId);
  const ids = activeLeagueId ? [activeLeagueId] : [];

  const [players, teams, seasons, showOverall] = await Promise.all([
    getPlayers(ids),
    getTeams(ids),
    activeLeagueId ? getSeasons(ids) : Promise.resolve([]),
    playerAttributesV1(),
  ]);

  const activeSeason =
    seasons.find((season) => season.status === "active") ?? seasons[0] ?? null;

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const ratingsByPlayerId = new Map<string, number | null>();

  if (showOverall && activeSeason) {
    const attributeRows = await listSeasonPlayerAttributes(activeSeason.id).catch(
      () => [],
    );
    for (const row of attributeRows) {
      ratingsByPlayerId.set(row.playerId, row.weightedOverall);
    }
  }

  const directoryPlayers: DirectoryPlayer[] = players.map((player) => {
    const team = teamById.get(player.teamId);
    return {
      ...player,
      teamName: team?.name ?? "\u2014",
      teamPrimaryColor: team?.primaryColor ?? null,
      overallRating: ratingsByPlayerId.get(player.id) ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Players"
        description={`All players on rosters${activeSeason ? ` · ${activeSeason.name}` : ""}`}
        action={
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard/teams" className="text-primary hover:underline">
              Teams &rarr;
            </Link>
            <Link
              href="/dashboard/divisions"
              className="text-primary hover:underline"
            >
              Divisions &rarr;
            </Link>
          </div>
        }
      />
      <PlayersTable players={directoryPlayers} showOverall={showOverall} />
    </div>
  );
}

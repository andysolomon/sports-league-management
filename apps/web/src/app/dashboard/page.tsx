import Link from "next/link";
import { getTeams, getPlayers, getSeasons, getDivisions } from "@/lib/salesforce-api";

const statCards = [
  { label: "Teams", href: "/dashboard/teams", key: "teams" },
  { label: "Players", href: "/dashboard/players", key: "players" },
  { label: "Seasons", href: "/dashboard/seasons", key: "seasons" },
  { label: "Divisions", href: "/dashboard/divisions", key: "divisions" },
] as const;

export default async function DashboardPage() {
  const [teams, players, seasons, divisions] = await Promise.all([
    getTeams(),
    getPlayers(),
    getSeasons(),
    getDivisions(),
  ]);

  const counts: Record<string, number> = {
    teams: teams.length,
    players: players.length,
    seasons: seasons.length,
    divisions: divisions.length,
  };

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Overview</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {counts[card.key]}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

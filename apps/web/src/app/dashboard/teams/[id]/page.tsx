import Link from "next/link";
import { getTeam, getPlayersByTeam } from "@/lib/salesforce-api";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [team, players] = await Promise.all([
    getTeam(id),
    getPlayersByTeam(id),
  ]);

  return (
    <div>
      <Link
        href="/dashboard/teams"
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Teams
      </Link>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {team.city && (
            <div>
              <dt className="font-medium text-gray-500">City</dt>
              <dd className="mt-1 text-gray-900">{team.city}</dd>
            </div>
          )}
          {team.stadium && (
            <div>
              <dt className="font-medium text-gray-500">Stadium</dt>
              <dd className="mt-1 text-gray-900">{team.stadium}</dd>
            </div>
          )}
          {team.foundedYear && (
            <div>
              <dt className="font-medium text-gray-500">Founded</dt>
              <dd className="mt-1 text-gray-900">{team.foundedYear}</dd>
            </div>
          )}
          {team.location && (
            <div>
              <dt className="font-medium text-gray-500">Location</dt>
              <dd className="mt-1 text-gray-900">{team.location}</dd>
            </div>
          )}
        </dl>
      </div>

      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Player Roster ({players.length})
      </h3>
      {players.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Jersey #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {players.map((player) => (
                <tr key={player.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {player.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {player.position}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {player.jerseyNumber ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {player.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No players on this team.</p>
      )}
    </div>
  );
}

import Link from "next/link";
import { getTeams } from "@/lib/salesforce-api";

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Teams</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/dashboard/teams/${team.id}`}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
            <dl className="mt-3 space-y-1 text-sm text-gray-600">
              {team.city && (
                <div>
                  <dt className="inline font-medium">City: </dt>
                  <dd className="inline">{team.city}</dd>
                </div>
              )}
              {team.stadium && (
                <div>
                  <dt className="inline font-medium">Stadium: </dt>
                  <dd className="inline">{team.stadium}</dd>
                </div>
              )}
              {team.foundedYear && (
                <div>
                  <dt className="inline font-medium">Founded: </dt>
                  <dd className="inline">{team.foundedYear}</dd>
                </div>
              )}
            </dl>
          </Link>
        ))}
        {teams.length === 0 && (
          <p className="text-gray-500">No teams found.</p>
        )}
      </div>
    </div>
  );
}

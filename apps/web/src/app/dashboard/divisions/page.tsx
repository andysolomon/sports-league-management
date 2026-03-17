import { getDivisions, getLeagues } from "@/lib/salesforce-api";

export default async function DivisionsPage() {
  const [divisions, leagues] = await Promise.all([
    getDivisions(),
    getLeagues(),
  ]);

  const leagueMap = new Map(leagues.map((l) => [l.id, l.name]));

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Divisions</h2>
      {divisions.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  League
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {divisions.map((division) => (
                <tr key={division.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {division.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {leagueMap.get(division.leagueId) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No divisions found.</p>
      )}
    </div>
  );
}

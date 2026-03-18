import { getDivisions, getLeagues } from "@/lib/salesforce-api";
import { DivisionsTable } from "./divisions-table";

export default async function DivisionsPage() {
  const [divisions, leagues] = await Promise.all([
    getDivisions(),
    getLeagues(),
  ]);

  const leagueMap = new Map(leagues.map((l) => [l.id, l.name]));

  const divisionsWithLeague = divisions.map((d) => ({
    ...d,
    leagueName: leagueMap.get(d.leagueId) ?? "\u2014",
  }));

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Divisions</h2>
      <DivisionsTable divisions={divisionsWithLeague} />
    </div>
  );
}

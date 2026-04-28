import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getDivisions, getLeagues } from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import { DivisionsTable } from "./divisions-table";

export default async function DivisionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const ids = orgContext.visibleLeagueIds;

  const [divisions, leagues] = await Promise.all([
    getDivisions(ids),
    getLeagues(ids),
  ]);

  const leagueMap = new Map(leagues.map((l) => [l.id, l.name]));

  const divisionsWithLeague = divisions.map((d) => ({
    ...d,
    leagueName: leagueMap.get(d.leagueId) ?? "\u2014",
  }));

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Divisions</h2>
      <DivisionsTable divisions={divisionsWithLeague} />
    </div>
  );
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getDivisions,
  getLeagues,
  getTeams,
  getLeagueOrgId,
} from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { getUserRoleInOrg } from "@/lib/org-context";
import { DivisionsTable } from "./divisions-table";
import { PageHeader } from "../_components/page-header";

export default async function DivisionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Scoped to the active league from the global switcher (WSM-000103).
  const { activeLeagueId } = await resolveActiveLeague(userId);
  const ids = activeLeagueId ? [activeLeagueId] : [];

  const [divisions, leagues, teams] = await Promise.all([
    getDivisions(ids),
    getLeagues(ids),
    getTeams(ids),
  ]);

  // Org-admin of the active league sees CRUD controls (members/coaches don't).
  const orgId = activeLeagueId ? await getLeagueOrgId(activeLeagueId) : null;
  const role = orgId ? await getUserRoleInOrg(orgId, userId) : null;
  const isAdmin = role === "org:admin";

  const leagueMap = new Map(leagues.map((l) => [l.id, l.name]));

  // Teams per division, to warn before a delete reassigns them (WSM-000128).
  const teamCounts = teams.reduce<Record<string, number>>((acc, team) => {
    if (team.divisionId) acc[team.divisionId] = (acc[team.divisionId] ?? 0) + 1;
    return acc;
  }, {});

  const divisionsWithLeague = divisions.map((d) => ({
    ...d,
    leagueName: leagueMap.get(d.leagueId) ?? "\u2014",
    teamCount: teamCounts[d.id] ?? 0,
  }));

  return (
    <div>
      <PageHeader title="Divisions" description="Divisions that group teams in the active league." />
      <DivisionsTable
        divisions={divisionsWithLeague}
        isAdmin={isAdmin}
        activeLeagueId={activeLeagueId}
      />
    </div>
  );
}

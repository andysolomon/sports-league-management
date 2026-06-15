import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getDivisions, getTeams, getLeagueOrgId } from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { getUserRoleInOrg } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Trophy } from "lucide-react";
import { LeagueSwitcher } from "../_components/league-switcher";
import {
  CreateLeagueButton,
  DeleteLeagueButton,
  RenameLeagueForm,
} from "./leagues-actions";
import { LeaguesAccordion, type AccordionDivision } from "./leagues-accordion";

export default async function LeaguesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { leagues, activeLeagueId, orgContext } =
    await resolveActiveLeague(userId);

  if (leagues.length === 0) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Leagues</h2>
          <CreateLeagueButton />
        </div>
        <EmptyState
          icon={Trophy}
          title="No leagues yet"
          description="Create a league, or add teams from Discover, to get started."
        />
      </div>
    );
  }

  const activeLeague =
    leagues.find((l) => l.id === activeLeagueId) ?? leagues[0];

  // Org-admin of the active league sees CRUD controls (members/coaches don't).
  const orgId = await getLeagueOrgId(activeLeague.id);
  const role = orgId ? await getUserRoleInOrg(orgId, userId) : null;
  const isAdmin = role === "org:admin";

  const [divisions, teams] = await Promise.all([
    getDivisions([activeLeague.id]),
    getTeams([activeLeague.id]),
  ]);

  const teamsByDivision = new Map<string, AccordionDivision["teams"]>();
  for (const team of teams) {
    const arr = teamsByDivision.get(team.divisionId) ?? [];
    arr.push({ id: team.id, name: team.name, city: team.city ?? null });
    teamsByDivision.set(team.divisionId, arr);
  }

  const accordionDivisions: AccordionDivision[] = divisions.map((d) => ({
    id: d.id,
    name: d.name,
    teams: teamsByDivision.get(d.id) ?? [],
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Leagues</h2>
          <LeagueSwitcher leagues={leagues} activeLeagueId={activeLeagueId} />
        </div>
        <CreateLeagueButton />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <Trophy className="h-5 w-5 shrink-0 text-primary" />
              <CardTitle className="truncate">{activeLeague.name}</CardTitle>
              <Badge variant="secondary" className="shrink-0">
                {divisions.length} division
                {divisions.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-1">
                <RenameLeagueForm
                  leagueId={activeLeague.id}
                  currentName={activeLeague.name}
                />
                <DeleteLeagueButton
                  leagueId={activeLeague.id}
                  leagueName={activeLeague.name}
                />
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <LeaguesAccordion
            leagueId={activeLeague.id}
            isAdmin={isAdmin}
            divisions={accordionDivisions}
          />
        </CardContent>
      </Card>
    </div>
  );
}

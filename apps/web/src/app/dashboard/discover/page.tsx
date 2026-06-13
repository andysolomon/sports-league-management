import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getPublicLeagues,
  getPublicLeagueImportTree,
  getLeagueClaimable,
  getOrgForkedSourceTeamIds,
} from "@/lib/data-api";
import DiscoverLeagues, { type DiscoverLeague } from "./discover-leagues";

export default async function DiscoverPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  // The org whose forks we mark as "Added" — the active org, else the user's
  // first admin org (a fork may have created one that isn't active yet).
  let forkOrgId = orgId ?? null;
  if (!forkOrgId) {
    const client = await clerkClient();
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
    });
    forkOrgId =
      memberships.data.find((m) => m.role === "org:admin")?.organization.id ??
      null;
  }

  const [publicLeagues, forkedIds] = await Promise.all([
    getPublicLeagues(),
    forkOrgId ? getOrgForkedSourceTeamIds(forkOrgId) : Promise.resolve([]),
  ]);
  const forked = new Set(forkedIds);

  // Discover is a catalog of reference leagues you fork teams from (WSM-000117).
  const leagues: DiscoverLeague[] = await Promise.all(
    publicLeagues.map(async (league) => {
      const [{ teams, divisions }, forkable] = await Promise.all([
        getPublicLeagueImportTree(league.id).catch(() => ({
          teams: [],
          divisions: [],
        })),
        getLeagueClaimable(league.id).catch(() => false),
      ]);
      return {
        id: league.id,
        name: league.name,
        forkable,
        divisions: divisions.map((d) => ({ id: d.id, name: d.name })),
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          divisionId: t.divisionId,
          added: forked.has(t.id),
        })),
      };
    }),
  );

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-foreground">
        Discover Leagues
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Browse leagues and add teams to your dashboard. Each team you add becomes
        your own private copy to manage — separate from everyone else.
      </p>
      <DiscoverLeagues leagues={leagues} />
    </div>
  );
}

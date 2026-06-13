import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPublicLeagues, getPublicLeagueImportTree } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import DiscoverLeagues, { type DiscoverLeague } from "./discover-leagues";

export default async function DiscoverPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Subscriptions (and à la carte team scopes) are the source of truth in
  // Convex; resolveOrgContext carries both (WSM-000099 / WSM-000100).
  const [orgContext, publicLeagues] = await Promise.all([
    resolveOrgContext(userId),
    getPublicLeagues(),
  ]);

  // Each public league carries its division/team tree so the card can offer
  // à la carte selection, plus the user's current import state.
  const leagues: DiscoverLeague[] = await Promise.all(
    publicLeagues.map(async (league) => {
      const { teams, divisions } = await getPublicLeagueImportTree(
        league.id,
      ).catch(() => ({ teams: [], divisions: [] }));
      return {
        id: league.id,
        name: league.name,
        subscribed: orgContext.subscribedLeagueIds.includes(league.id),
        // null = imported all (or not subscribed); array = the imported subset.
        importedTeamIds: orgContext.subscriptionTeamScopes[league.id] ?? null,
        divisions: divisions.map((d) => ({ id: d.id, name: d.name })),
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          divisionId: t.divisionId,
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
        Browse public leagues and import them. Import everything, or pick the
        divisions and teams you want.
      </p>
      <DiscoverLeagues leagues={leagues} />
    </div>
  );
}

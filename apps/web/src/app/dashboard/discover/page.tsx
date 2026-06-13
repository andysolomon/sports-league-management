import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPublicLeagues } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import DiscoverLeagues from "./discover-leagues";

export default async function DiscoverPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Subscriptions are the source of truth in Convex (leagueSubscriptions),
  // not Clerk publicMetadata — the subscribe route only writes Convex, so the
  // old metadata read was always empty and every card showed "Subscribe"
  // (WSM-000099). resolveOrgContext returns the real subscribed league ids.
  const [orgContext, publicLeagues] = await Promise.all([
    resolveOrgContext(userId),
    getPublicLeagues(),
  ]);
  const subscribedLeagueIds = orgContext.subscribedLeagueIds;

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-foreground">
        Discover Leagues
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Browse public leagues and add them to your dashboard.
      </p>
      <DiscoverLeagues
        leagues={publicLeagues}
        subscribedIds={subscribedLeagueIds}
      />
    </div>
  );
}

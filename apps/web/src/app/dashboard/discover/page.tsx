import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPublicLeagues } from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import DiscoverLeagues from "./discover-leagues";

export default async function DiscoverPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const publicLeagues = await getPublicLeagues();

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">
        Discover Leagues
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Browse public leagues and add them to your dashboard.
      </p>
      <DiscoverLeagues
        leagues={publicLeagues}
        subscribedIds={orgContext.subscribedLeagueIds}
      />
    </div>
  );
}

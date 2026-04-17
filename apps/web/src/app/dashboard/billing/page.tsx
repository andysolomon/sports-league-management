import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserTier, getStripeCustomerId } from "@/lib/authorization";
import { TIER_CONFIGS } from "@/lib/tiers";
import { getTeams } from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "./_components/billing-actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const tier = await getUserTier();
  const stripeCustomerId = await getStripeCustomerId();
  const config = TIER_CONFIGS[tier];

  // Fetch usage stats from the app data store (Convex).
  let teamCount = 0;
  try {
    const orgContext = await resolveOrgContext(userId);
    const teams = await getTeams(orgContext.visibleLeagueIds);
    teamCount = teams.length;
  } catch {
    // Data-store errors should not break the billing page
    teamCount = 0;
  }

  const teamLimit = config.limits.maxTeams;
  const teamLimitDisplay = teamLimit === -1 ? "unlimited" : teamLimit.toString();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-zinc-600">Manage your subscription and usage</p>
      </div>

      {params.success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <p className="text-sm text-green-900">
              ✓ Subscription activated. Welcome to {config.name}!
            </p>
          </CardContent>
        </Card>
      )}

      {params.cancelled && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <p className="text-sm text-amber-900">
              Checkout cancelled. You can upgrade anytime below.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Current plan card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Plan
                <Badge variant={tier === "free" ? "secondary" : "default"}>
                  {config.name}
                </Badge>
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Teams</p>
              <p className="text-2xl font-semibold">
                {teamCount}
                <span className="text-sm font-normal text-zinc-500"> / {teamLimitDisplay}</span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Players</p>
              <p className="text-2xl font-semibold">
                <span className="text-sm font-normal text-zinc-500">unlimited</span>
              </p>
            </div>
          </div>

          {stripeCustomerId && tier !== "free" && (
            <div className="pt-4">
              <BillingActions hasSubscription={true} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing table for upgrades */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Choose a plan</h2>
        <BillingActions currentTier={tier} hasSubscription={false} showPricingTable />
      </div>
    </div>
  );
}

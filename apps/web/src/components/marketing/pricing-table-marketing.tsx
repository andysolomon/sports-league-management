"use client";

import { useRouter } from "next/navigation";
import { PricingTable } from "@/components/pricing-table";
import type { Tier, BillingInterval } from "@/lib/tiers";

/**
 * Marketing-page wrapper for PricingTable.
 *
 * For unauthenticated visitors, clicking a paid tier sends them into sign-up
 * with the chosen plan + interval preserved (`/sign-up?plan=<tier>&interval=…`)
 * so the funnel can resume checkout after auth. We route by tier (not a Stripe
 * price id) because price ids are server-only and null in this client bundle —
 * the old code silently no-op'd on the missing id (WSM-000169).
 *
 * No `currentTier` is passed: anonymous visitors must not see a "Current Plan"
 * badge (WSM-000170).
 */
export function PricingTableMarketing() {
  const router = useRouter();

  const handleSelectPlan = (tier: Tier, interval: BillingInterval) => {
    router.push(
      `/sign-up?plan=${encodeURIComponent(tier)}&interval=${encodeURIComponent(interval)}`,
    );
  };

  return <PricingTable onSelectPlan={handleSelectPlan} />;
}

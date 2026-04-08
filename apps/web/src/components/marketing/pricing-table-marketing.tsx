"use client";

import { useRouter } from "next/navigation";
import { PricingTable } from "@/components/pricing-table";
import type { Tier } from "@/lib/tiers";

/**
 * Marketing-page wrapper for PricingTable.
 *
 * For unauthenticated visitors, clicking a paid tier sends them to
 * /sign-up?priceId=<id> so they can complete signup before checkout.
 * Free tier is the "current plan" by default for visitors.
 */
export function PricingTableMarketing() {
  const router = useRouter();

  const handleSelectPlan = (priceId: string, _tier: Tier) => {
    router.push(`/sign-up?priceId=${encodeURIComponent(priceId)}`);
  };

  return (
    <PricingTable currentTier="free" onSelectPlan={handleSelectPlan} />
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PricingTable } from "@/components/pricing-table";
import type { Tier } from "@/lib/tiers";

interface BillingActionsProps {
  currentTier?: Tier;
  hasSubscription: boolean;
  showPricingTable?: boolean;
}

export function BillingActions({
  currentTier,
  hasSubscription,
  showPricingTable,
}: BillingActionsProps) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to open billing portal");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      setIsLoadingPortal(false);
    }
  };

  const handleSelectPlan = async (priceId: string) => {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to start checkout");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    }
  };

  if (showPricingTable) {
    return (
      <PricingTable currentTier={currentTier} onSelectPlan={handleSelectPlan} />
    );
  }

  if (hasSubscription) {
    return (
      <Button
        variant="outline"
        onClick={handleManageSubscription}
        disabled={isLoadingPortal}
      >
        {isLoadingPortal ? "Loading..." : "Manage Subscription"}
      </Button>
    );
  }

  return null;
}

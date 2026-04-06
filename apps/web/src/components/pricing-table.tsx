"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TIER_CONFIGS, TIER_ORDER, type Tier, type BillingInterval } from "@/lib/tiers";
import { cn } from "@/lib/utils";

interface PricingTableProps {
  currentTier?: Tier;
  onSelectPlan?: (priceId: string, tier: Tier) => void | Promise<void>;
  defaultInterval?: BillingInterval;
}

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function calculateAnnualSavings(monthly: number, yearly: number): number {
  if (monthly === 0 || yearly === 0) return 0;
  const annualFromMonthly = monthly * 12;
  return Math.round(((annualFromMonthly - yearly) / annualFromMonthly) * 100);
}

export function PricingTable({
  currentTier,
  onSelectPlan,
  defaultInterval = "monthly",
}: PricingTableProps) {
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);

  const handleSelect = async (tier: Tier) => {
    if (!onSelectPlan) return;
    const config = TIER_CONFIGS[tier];
    const priceId = interval === "monthly" ? config.monthlyPriceId : config.yearlyPriceId;
    if (!priceId) return;

    setLoadingTier(tier);
    try {
      await onSelectPlan(priceId, tier);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setInterval("monthly")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            interval === "monthly"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:text-zinc-900",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("yearly")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            interval === "yearly"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:text-zinc-900",
          )}
        >
          Yearly
          <Badge variant="secondary" className="ml-2">
            Save up to 17%
          </Badge>
        </button>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const config = TIER_CONFIGS[tier];
          const isCurrent = currentTier === tier;
          const isFree = tier === "free";
          const price = interval === "monthly" ? config.monthlyPrice : config.yearlyPrice;
          const savings = calculateAnnualSavings(config.monthlyPrice, config.yearlyPrice);

          return (
            <Card
              key={tier}
              className={cn(
                "relative flex flex-col",
                isCurrent && "border-zinc-900 shadow-lg",
              )}
            >
              {isCurrent && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                  Current Plan
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{config.name}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-4">
                  <span className="text-3xl font-bold">{formatPrice(price)}</span>
                  {!isFree && (
                    <span className="text-sm text-zinc-500">
                      /{interval === "monthly" ? "mo" : "yr"}
                    </span>
                  )}
                  {!isFree && interval === "yearly" && savings > 0 && (
                    <p className="mt-1 text-xs text-green-600">Save {savings}% vs monthly</p>
                  )}
                </div>

                <ul className="mb-6 space-y-2 text-sm">
                  {config.highlights.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {isFree ? (
                    <Button variant="outline" className="w-full" disabled={isCurrent}>
                      {isCurrent ? "Current plan" : "Free forever"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || loadingTier === tier}
                      onClick={() => handleSelect(tier)}
                    >
                      {isCurrent
                        ? "Current plan"
                        : loadingTier === tier
                          ? "Loading..."
                          : `Upgrade to ${config.name}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

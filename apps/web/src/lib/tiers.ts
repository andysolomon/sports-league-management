/**
 * Subscription tier configuration.
 *
 * Tiers are stored in Clerk publicMetadata.tier and synced from Stripe via
 * webhook events. Free tier is the default for new users.
 */

export type Tier = "free" | "plus" | "club" | "league";

export type BillingInterval = "monthly" | "yearly";

export interface TierLimits {
  maxTeams: number; // -1 = unlimited
  maxPlayersPerTeam: number; // -1 = unlimited
}

export interface TierFeatures {
  paymentCollection: boolean;
  notifications: boolean;
  multiAdmin: boolean;
  analytics: boolean;
  customBranding: boolean;
  multiLocation: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export interface TierConfig {
  id: Tier;
  name: string;
  description: string;
  monthlyPrice: number; // cents
  yearlyPrice: number; // cents
  monthlyPriceId: string | null;
  yearlyPriceId: string | null;
  limits: TierLimits;
  features: TierFeatures;
  highlights: string[];
}

const FREE_FEATURES: TierFeatures = {
  paymentCollection: false,
  notifications: false,
  multiAdmin: false,
  analytics: false,
  customBranding: false,
  multiLocation: false,
  apiAccess: false,
  prioritySupport: false,
};

const PLUS_FEATURES: TierFeatures = {
  ...FREE_FEATURES,
  paymentCollection: true,
  notifications: true,
};

const CLUB_FEATURES: TierFeatures = {
  ...PLUS_FEATURES,
  multiAdmin: true,
  analytics: true,
  customBranding: true,
};

const LEAGUE_FEATURES: TierFeatures = {
  ...CLUB_FEATURES,
  multiLocation: true,
  apiAccess: true,
  prioritySupport: true,
};

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "Get started managing your team",
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyPriceId: null,
    yearlyPriceId: null,
    limits: { maxTeams: 1, maxPlayersPerTeam: -1 },
    features: FREE_FEATURES,
    highlights: ["1 team", "Unlimited players", "Basic schedule"],
  },
  plus: {
    id: "plus",
    name: "Plus",
    description: "For active coaches and team managers",
    monthlyPrice: 499,
    yearlyPrice: 4900,
    monthlyPriceId: process.env.STRIPE_PRICE_PLUS_MONTHLY ?? null,
    yearlyPriceId: process.env.STRIPE_PRICE_PLUS_YEARLY ?? null,
    limits: { maxTeams: -1, maxPlayersPerTeam: -1 },
    features: PLUS_FEATURES,
    highlights: [
      "Unlimited teams",
      "Payment collection",
      "Email & SMS notifications",
    ],
  },
  club: {
    id: "club",
    name: "Club",
    description: "For multi-team clubs and organizations",
    monthlyPrice: 1999,
    yearlyPrice: 19900,
    monthlyPriceId: process.env.STRIPE_PRICE_CLUB_MONTHLY ?? null,
    yearlyPriceId: process.env.STRIPE_PRICE_CLUB_YEARLY ?? null,
    limits: { maxTeams: -1, maxPlayersPerTeam: -1 },
    features: CLUB_FEATURES,
    highlights: [
      "Everything in Plus",
      "Multiple admins",
      "Analytics dashboard",
      "Custom branding",
    ],
  },
  league: {
    id: "league",
    name: "League",
    description: "For leagues and associations",
    monthlyPrice: 4999,
    yearlyPrice: 49900,
    monthlyPriceId: process.env.STRIPE_PRICE_LEAGUE_MONTHLY ?? null,
    yearlyPriceId: process.env.STRIPE_PRICE_LEAGUE_YEARLY ?? null,
    limits: { maxTeams: -1, maxPlayersPerTeam: -1 },
    features: LEAGUE_FEATURES,
    highlights: [
      "Everything in Club",
      "Multi-location support",
      "API access",
      "Priority support",
    ],
  },
};

export const TIER_ORDER: Tier[] = ["free", "plus", "club", "league"];

export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIGS[tier];
}

export function getTierLimits(tier: Tier): TierLimits {
  return TIER_CONFIGS[tier].limits;
}

/**
 * Reverse lookup: Stripe price ID → Tier.
 * Built lazily from env vars to avoid stale data during tests.
 */
export function getTierFromPriceId(priceId: string): Tier | null {
  for (const tier of TIER_ORDER) {
    const config = TIER_CONFIGS[tier];
    if (config.monthlyPriceId === priceId || config.yearlyPriceId === priceId) {
      return tier;
    }
  }
  return null;
}

/**
 * Tier hierarchy comparison. Returns true if `userTier` meets or exceeds
 * `requiredTier`.
 */
export function tierMeetsRequirement(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier);
}

export function isPaidTier(tier: Tier): boolean {
  return tier !== "free";
}

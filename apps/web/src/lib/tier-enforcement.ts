import { TIER_CONFIGS, type Tier, type TierFeatures } from "./tiers";
import { ApiError } from "./api-error";

/**
 * Throws ApiError(403) if the user's current usage exceeds their tier's limit
 * for the given resource. -1 means unlimited.
 */
export function enforceTierLimit(
  tier: Tier,
  resource: "teams" | "playersPerTeam",
  currentCount: number,
): void {
  const limits = TIER_CONFIGS[tier].limits;

  let max: number;
  let resourceName: string;

  switch (resource) {
    case "teams":
      max = limits.maxTeams;
      resourceName = "team";
      break;
    case "playersPerTeam":
      max = limits.maxPlayersPerTeam;
      resourceName = "player";
      break;
  }

  if (max === -1) return; // unlimited
  if (currentCount < max) return;

  // Find the next tier that lifts this limit
  const nextTier = findNextTierWithUnlimited(tier, resource);
  const upgradeMessage = nextTier
    ? `Upgrade to ${TIER_CONFIGS[nextTier].name} for unlimited ${resourceName}s.`
    : "";

  throw new ApiError({
    statusCode: 403,
    message: `${TIER_CONFIGS[tier].name} plan is limited to ${max} ${resourceName}${max === 1 ? "" : "s"}. ${upgradeMessage}`.trim(),
    details: { requiredTier: nextTier, currentTier: tier, resource, max },
  });
}

/**
 * Throws ApiError(403) if the tier does not include the given feature.
 */
export function requireFeature(tier: Tier, feature: keyof TierFeatures): void {
  if (TIER_CONFIGS[tier].features[feature]) return;

  const nextTier = findNextTierWithFeature(tier, feature);
  throw new ApiError({
    statusCode: 403,
    message: nextTier
      ? `This feature requires ${TIER_CONFIGS[nextTier].name} or higher.`
      : "This feature is not available on your plan.",
    details: { requiredTier: nextTier, currentTier: tier, feature },
  });
}

function findNextTierWithUnlimited(
  currentTier: Tier,
  resource: "teams" | "playersPerTeam",
): Tier | null {
  const order: Tier[] = ["free", "plus", "club", "league"];
  const startIdx = order.indexOf(currentTier) + 1;
  for (let i = startIdx; i < order.length; i++) {
    const t = order[i];
    const limits = TIER_CONFIGS[t].limits;
    const max =
      resource === "teams" ? limits.maxTeams : limits.maxPlayersPerTeam;
    if (max === -1) return t;
  }
  return null;
}

function findNextTierWithFeature(
  currentTier: Tier,
  feature: keyof TierFeatures,
): Tier | null {
  const order: Tier[] = ["free", "plus", "club", "league"];
  const startIdx = order.indexOf(currentTier) + 1;
  for (let i = startIdx; i < order.length; i++) {
    const t = order[i];
    if (TIER_CONFIGS[t].features[feature]) return t;
  }
  return null;
}

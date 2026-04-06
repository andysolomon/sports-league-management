import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import type { Tier } from "./tiers";

export interface AuthorizationResult {
  userId: string;
  authorizedTeamIds: string[];
  isAuthorized: boolean;
}

export async function authorizeTeamMutation(
  teamId: string,
): Promise<AuthorizationResult> {
  const { userId } = await auth();
  if (!userId) {
    return { userId: "", authorizedTeamIds: [], isAuthorized: false };
  }

  const user = await currentUser();
  const managedTeamIds =
    (user?.publicMetadata?.managedTeamIds as string[]) ?? [];

  return {
    userId,
    authorizedTeamIds: managedTeamIds,
    isAuthorized: managedTeamIds.includes(teamId),
  };
}

export async function canManageTeam(teamId: string): Promise<boolean> {
  const result = await authorizeTeamMutation(teamId);
  return result.isAuthorized;
}

/**
 * Reads the current user's subscription tier from Clerk publicMetadata.
 * Defaults to "free" if no tier is set.
 */
export async function getUserTier(): Promise<Tier> {
  const user = await currentUser();
  const tier = user?.publicMetadata?.tier as Tier | undefined;
  return tier ?? "free";
}

/**
 * Reads the current user's Stripe customer ID from privateMetadata.
 * Returns null if the user has never subscribed.
 *
 * Server-only — privateMetadata is never exposed to the client.
 */
export async function getStripeCustomerId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const customerId = user.privateMetadata?.stripeCustomerId as
    | string
    | undefined;
  return customerId ?? null;
}

import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Prod sweep global setup (WSM-000188). Only fetches the Clerk testing token
 * (bot-bypass) so `setupClerkTestingToken` works against the prod Clerk
 * instance. Unlike the functional suite's global-setup it does NOT seed Convex
 * — the prod sweep is strictly read-only.
 */
export default async function globalSetup() {
  await clerkSetup();
}

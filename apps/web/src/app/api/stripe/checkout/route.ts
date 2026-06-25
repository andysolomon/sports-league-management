import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getStripeCustomerId } from "@/lib/authorization";
import {
  TIER_CONFIGS,
  TIER_ORDER,
  type Tier,
  type BillingInterval,
} from "@/lib/tiers";
import { handleApiError, ApiError } from "@/lib/api-error";

/**
 * Resolve a Stripe price id from a (paid) tier + interval. Price ids live in
 * server-only env (`STRIPE_PRICE_*`), so the CLIENT cannot send them — it sends
 * the tier and we resolve here (WSM-000169). Returns null for a free/unknown
 * tier or a plan whose price isn't configured in this environment.
 */
function resolvePriceId(tier: unknown, interval: unknown): string | null {
  if (typeof tier !== "string" || !TIER_ORDER.includes(tier as Tier)) {
    return null;
  }
  if (tier === "free") return null;
  const billing: BillingInterval = interval === "yearly" ? "yearly" : "monthly";
  const config = TIER_CONFIGS[tier as Tier];
  return billing === "yearly" ? config.yearlyPriceId : config.monthlyPriceId;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const priceId = resolvePriceId(body?.tier, body?.interval);
    if (!priceId) {
      throw new ApiError({
        statusCode: 400,
        message: "A valid paid tier is required",
      });
    }

    const stripe = getStripe();
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;

    // Find or create the Stripe customer
    let customerId = await getStripeCustomerId();
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { clerkUserId: userId },
      });
      customerId = customer.id;

      // Persist customer ID to Clerk privateMetadata
      const client = await clerkClient();
      await client.users.updateUserMetadata(userId, {
        privateMetadata: { stripeCustomerId: customerId },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?cancelled=true`,
      client_reference_id: userId,
      metadata: { clerkUserId: userId },
      subscription_data: {
        metadata: { clerkUserId: userId },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error, "/api/stripe/checkout");
  }
}

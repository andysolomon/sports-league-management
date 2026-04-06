import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getStripeCustomerId } from "@/lib/authorization";
import { TIER_CONFIGS, TIER_ORDER } from "@/lib/tiers";
import { handleApiError, ApiError } from "@/lib/api-error";

// Build the set of valid price IDs at module load
function getValidPriceIds(): Set<string> {
  const ids = new Set<string>();
  for (const tier of TIER_ORDER) {
    const config = TIER_CONFIGS[tier];
    if (config.monthlyPriceId) ids.add(config.monthlyPriceId);
    if (config.yearlyPriceId) ids.add(config.yearlyPriceId);
  }
  return ids;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const priceId = body?.priceId as string | undefined;

    if (!priceId || typeof priceId !== "string") {
      throw new ApiError({ statusCode: 400, message: "priceId is required" });
    }

    const validPriceIds = getValidPriceIds();
    if (!validPriceIds.has(priceId)) {
      throw new ApiError({
        statusCode: 400,
        message: "Invalid priceId",
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

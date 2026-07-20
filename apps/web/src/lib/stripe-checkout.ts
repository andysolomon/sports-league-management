import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { getStripeCustomerId } from "@/lib/authorization";

/**
 * Create a Stripe subscription Checkout session for `userId` + `priceId` and
 * return its hosted URL. Finds or lazily creates the user's Stripe customer
 * (persisted to Clerk privateMetadata). Shared by `POST /api/stripe/checkout`
 * (in-app upgrade) and `GET /checkout/start` (post-sign-up resume, WSM-000171).
 */
export async function createSubscriptionCheckoutUrl(
  userId: string,
  priceId: string,
): Promise<string> {
  const stripe = getStripe();
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  let customerId = await getStripeCustomerId();
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { clerkUserId: userId },
    });
    customerId = customer.id;
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
    success_url: `${appUrl}/dashboard/settings/account/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/settings/account/billing?cancelled=true`,
    client_reference_id: userId,
    metadata: { clerkUserId: userId },
    subscription_data: { metadata: { clerkUserId: userId } },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return session.url;
}

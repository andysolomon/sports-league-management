import type Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import { getStripe } from "./stripe";
import { getTierFromPriceId, type Tier } from "./tiers";
import { sendReceiptEmail, sendPaymentFailedEmail } from "./emails/receipt";

/**
 * Main dispatcher — routes Stripe events to specific handlers.
 * Unhandled event types are silently ignored (return 200 from the route).
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object);
      break;
    default:
      // No-op for unhandled events
      break;
  }
}

/**
 * checkout.session.completed
 * - Resolve the user via session metadata or client_reference_id
 * - Look up the subscription's price → tier
 * - Update Clerk publicMetadata.tier and privateMetadata.stripeCustomerId
 * - Send receipt email
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const clerkUserId =
    (session.metadata?.clerkUserId as string | undefined) ??
    session.client_reference_id ??
    undefined;

  if (!clerkUserId) {
    console.error(
      JSON.stringify({
        level: "warn",
        message: "checkout.session.completed missing clerkUserId",
        sessionId: session.id,
      }),
    );
    return;
  }

  if (!session.subscription) return;

  const stripe = getStripe();
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? getTierFromPriceId(priceId) : null;

  if (!tier) {
    console.error(
      JSON.stringify({
        level: "warn",
        message: "Could not resolve tier from price",
        priceId,
        sessionId: session.id,
      }),
    );
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  await syncUserTier(clerkUserId, tier, customerId);

  // Fire-and-forget receipt email (don't fail webhook if email fails)
  if (session.customer_details?.email && priceId) {
    try {
      await sendReceiptEmail({
        to: session.customer_details.email,
        tier,
        amountCents: session.amount_total ?? 0,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "warn",
          message: `Receipt email failed: ${err instanceof Error ? err.message : String(err)}`,
          sessionId: session.id,
        }),
      );
    }
  }
}

/**
 * customer.subscription.updated / created
 * - Resolve user via Stripe customer metadata
 * - Update tier based on current subscription items
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const clerkUserId = await getClerkUserIdFromCustomer(customerId);
  if (!clerkUserId) return;

  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? getTierFromPriceId(priceId) : null;
  if (!tier) return;

  await syncUserTier(clerkUserId, tier, customerId);
}

/**
 * customer.subscription.deleted
 * - Reset tier to "free"
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const clerkUserId = await getClerkUserIdFromCustomer(customerId);
  if (!clerkUserId) return;

  await syncUserTier(clerkUserId, "free", customerId);
}

/**
 * invoice.payment_failed
 * - Set billingStatus to "past_due"
 * - Send payment failure email
 */
export async function handlePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const clerkUserId = await getClerkUserIdFromCustomer(customerId);
  if (!clerkUserId) return;

  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  await client.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      ...(user.publicMetadata ?? {}),
      billingStatus: "past_due",
    },
  });

  if (invoice.customer_email) {
    try {
      await sendPaymentFailedEmail({
        to: invoice.customer_email,
        amountCents: invoice.amount_due ?? 0,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "warn",
          message: `Payment failed email error: ${err instanceof Error ? err.message : String(err)}`,
        }),
      );
    }
  }
}

/**
 * Helper: update Clerk user metadata with tier and Stripe customer ID
 */
async function syncUserTier(
  clerkUserId: string,
  tier: Tier,
  stripeCustomerId?: string,
): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);

  await client.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      ...(user.publicMetadata ?? {}),
      tier,
      billingStatus: "active",
    },
    privateMetadata: stripeCustomerId
      ? {
          ...(user.privateMetadata ?? {}),
          stripeCustomerId,
        }
      : (user.privateMetadata ?? {}),
  });
}

/**
 * Helper: find Clerk user by Stripe customer ID
 * Reads clerkUserId from the Stripe customer's metadata
 */
async function getClerkUserIdFromCustomer(
  customerId: string,
): Promise<string | null> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const clerkUserId = customer.metadata?.clerkUserId;
  return clerkUserId ?? null;
}

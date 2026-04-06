import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe-webhook-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "STRIPE_WEBHOOK_SECRET not configured",
        route: "/api/stripe/webhook",
      }),
    );
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: `Webhook signature verification failed: ${message}`,
        route: "/api/stripe/webhook",
      }),
    );
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: `Webhook handler failed: ${message}`,
        eventType: event.type,
        eventId: event.id,
        route: "/api/stripe/webhook",
      }),
    );
    // Return 500 so Stripe retries the event
    return NextResponse.json(
      { error: "Handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getMux } from "@/lib/mux";
import {
  handleMuxEvent,
  type MuxWebhookEvent,
} from "@/lib/mux-webhook-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Mux live-stream webhook (WSM-000144). Mirrors the Stripe webhook route:
 * read the RAW body, verify the signature with MUX_WEBHOOK_SECRET (via the SDK's
 * webhooks.unwrap, which uses the secret configured on the client), structured
 * JSON logging, 400 on bad signature, 500 (so Mux retries) on handler failure.
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "MUX_WEBHOOK_SECRET not configured",
        route: "/api/streams/mux/webhook",
      }),
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();

  let event: MuxWebhookEvent;
  try {
    const mux = getMux();
    // Verifies the Mux-Signature header against the raw body using the
    // configured webhookSecret; throws if the signature is invalid.
    event = mux.webhooks.unwrap(
      body,
      request.headers,
    ) as unknown as MuxWebhookEvent;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: `Mux webhook signature verification failed: ${message}`,
        route: "/api/streams/mux/webhook",
      }),
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleMuxEvent(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: `Mux webhook handler failed: ${message}`,
        eventType: event.type,
        route: "/api/streams/mux/webhook",
      }),
    );
    // 500 → Mux retries the delivery.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

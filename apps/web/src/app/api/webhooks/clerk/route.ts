import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { sendWelcomeEmail } from "@/lib/emails/welcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clerk webhook payload shape for user.created (and similar) events.
 * We only model the fields we actually use; full schema in Clerk docs.
 */
interface ClerkUserEvent {
  type: string;
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email_addresses: Array<{
      id: string;
      email_address: string;
    }>;
    primary_email_address_id: string | null;
  };
}

function logError(message: string, extra: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      route: "/api/webhooks/clerk",
      message,
      ...extra,
    }),
  );
}

export async function POST(request: NextRequest) {
  // 1. Read svix headers
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    logError("Missing svix headers");
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 },
    );
  }

  // 2. Read raw body for signature verification
  const body = await request.text();

  // 3. Verify signature
  const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!webhookSecret) {
    logError("CLERK_WEBHOOK_SIGNING_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  let event: ClerkUserEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch (err) {
    logError("Signature verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 4. Dispatch by event type
  try {
    if (event.type === "user.created") {
      await handleUserCreated(event);
    }
    // All other event types are silently acknowledged.
    // Add new branches here as we expand webhook handling.
  } catch (err) {
    // Log the failure but return 200 so Clerk does NOT retry on transient
    // downstream errors (e.g., Resend rate limit). The user will still
    // exist in Clerk; we just won't get a welcome email this time.
    logError("Webhook handler failed", {
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ received: true });
}

async function handleUserCreated(event: ClerkUserEvent) {
  const { data } = event;

  // Resolve the primary email address
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  )?.email_address;

  // Fall back to the first email if Clerk didn't mark a primary
  const email = primaryEmail ?? data.email_addresses[0]?.email_address;

  if (!email) {
    logError("user.created event with no email address", { userId: data.id });
    return;
  }

  await sendWelcomeEmail({
    to: email,
    firstName: data.first_name,
  });
}

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolvePriceId } from "@/lib/tiers";
import { createSubscriptionCheckoutUrl } from "@/lib/stripe-checkout";

/**
 * GET /checkout/start?plan=<tier>&interval=<monthly|yearly>
 *
 * Resumes Stripe checkout after sign-up (WSM-000171). The sign-up page sets this
 * as Clerk's post-signup redirect when a marketing pricing CTA carried a plan,
 * so a coach who clicked "Upgrade to Plus" lands straight in checkout.
 *
 * - Not signed in → bounce back to /sign-up preserving the plan intent.
 * - Missing/invalid plan → fall through to the billing page (no dead-end).
 * - Otherwise → create a Checkout session and redirect to Stripe.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;
  const plan = searchParams.get("plan");
  const interval = searchParams.get("interval");

  const { userId } = await auth();
  if (!userId) {
    const q = plan
      ? `?plan=${encodeURIComponent(plan)}&interval=${encodeURIComponent(interval ?? "monthly")}`
      : "";
    return NextResponse.redirect(`${appUrl}/sign-up${q}`);
  }

  const priceId = resolvePriceId(plan, interval);
  if (!priceId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings/account/billing`);
  }

  try {
    const url = await createSubscriptionCheckoutUrl(userId, priceId);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard/settings/account/billing?error=checkout`);
  }
}

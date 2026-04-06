import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getStripeCustomerId } from "@/lib/authorization";
import { handleApiError, ApiError } from "@/lib/api-error";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const customerId = await getStripeCustomerId();
    if (!customerId) {
      throw new ApiError({
        statusCode: 404,
        message: "No subscription found. Subscribe first to manage billing.",
      });
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error, "/api/stripe/portal");
  }
}

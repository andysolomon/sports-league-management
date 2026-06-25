import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolvePriceId } from "@/lib/tiers";
import { createSubscriptionCheckoutUrl } from "@/lib/stripe-checkout";
import { handleApiError, ApiError } from "@/lib/api-error";

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

    const url = await createSubscriptionCheckoutUrl(userId, priceId);
    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error, "/api/stripe/checkout");
  }
}

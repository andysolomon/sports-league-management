import Stripe from "stripe";

let cachedClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }

  cachedClient = new Stripe(secretKey, {
    apiVersion: "2025-09-30.clover",
    typescript: true,
    appInfo: {
      name: "sprtsmng",
      url: "https://sprtsmng.andrewsolomon.dev",
    },
  });

  return cachedClient;
}

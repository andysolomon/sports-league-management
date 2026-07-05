import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign up",
  description:
    "Create a free sprtsmng account. Manage your team without the spreadsheets.",
  robots: { index: true, follow: true },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  // When a marketing pricing CTA carried a plan, resume Stripe checkout right
  // after sign-up by sending the new account through /checkout/start (WSM-000171).
  const { plan, interval } = await searchParams;
  const redirectUrl = plan
    ? `/checkout/start?plan=${encodeURIComponent(plan)}&interval=${encodeURIComponent(interval ?? "monthly")}`
    : undefined;

  return (
    <SignUp
      forceRedirectUrl={redirectUrl}
      fallbackRedirectUrl={redirectUrl}
    />
  );
}

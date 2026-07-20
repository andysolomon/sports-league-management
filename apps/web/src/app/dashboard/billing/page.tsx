import { permanentRedirect } from "next/navigation";
import { accountBillingHref } from "@/components/workspace/resource-navigation";

/**
 * Legacy Billing URL. The Billing UI moved under Account Settings (issue
 * #576, ASR-8). Stripe Checkout / portal return URLs historically pointed
 * here, so the redirect must preserve every query param (`success`,
 * `cancelled`, `session_id`, `error`).
 */
export default async function LegacyBillingRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  permanentRedirect(`${accountBillingHref()}${suffix}`);
}

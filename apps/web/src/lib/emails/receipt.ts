import { getResend, getFromEmail } from "../resend";
import { TIER_CONFIGS, type Tier } from "../tiers";

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

interface ReceiptEmailParams {
  to: string;
  tier: Tier;
  amountCents: number;
}

export async function sendReceiptEmail(params: ReceiptEmailParams) {
  const { to, tier, amountCents } = params;
  const config = TIER_CONFIGS[tier];
  const resend = getResend();

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
      <h1 style="font-size: 24px; margin: 0 0 8px;">Welcome to ${config.name}</h1>
      <p style="color: #71717a; margin: 0 0 24px;">Thanks for subscribing to sprtsmng.</p>

      <div style="border: 1px solid #e4e4e7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span>Plan</span>
          <strong>${config.name}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span>Amount</span>
          <strong>${formatAmount(amountCents)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Date</span>
          <strong>${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong>
        </div>
      </div>

      <p style="color: #71717a; font-size: 14px;">
        Manage your subscription anytime from your
        <a href="https://sprtsmng.andrewsolomon.dev/dashboard/billing" style="color: #2563eb;">billing dashboard</a>.
      </p>
    </div>
  `;

  return resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `Welcome to sprtsmng ${config.name}`,
    html,
  });
}

interface PaymentFailedEmailParams {
  to: string;
  amountCents: number;
}

export async function sendPaymentFailedEmail(params: PaymentFailedEmailParams) {
  const { to, amountCents } = params;
  const resend = getResend();

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
      <h1 style="font-size: 24px; margin: 0 0 8px;">Payment failed</h1>
      <p style="color: #71717a; margin: 0 0 24px;">
        We were unable to process a payment of ${formatAmount(amountCents)} for your sprtsmng subscription.
      </p>

      <p style="margin-bottom: 24px;">
        Please update your payment method to keep your subscription active.
      </p>

      <a href="https://sprtsmng.andrewsolomon.dev/dashboard/billing"
         style="display: inline-block; background: #18181b; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none;">
        Update payment method
      </a>
    </div>
  `;

  return resend.emails.send({
    from: getFromEmail(),
    to,
    subject: "sprtsmng — Payment failed",
    html,
  });
}

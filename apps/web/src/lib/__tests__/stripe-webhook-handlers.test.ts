import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env vars before any imports
process.env.STRIPE_PRICE_PLUS_MONTHLY = "price_plus_monthly";
process.env.STRIPE_PRICE_PLUS_YEARLY = "price_plus_yearly";
process.env.STRIPE_PRICE_CLUB_MONTHLY = "price_club_monthly";
process.env.STRIPE_PRICE_CLUB_YEARLY = "price_club_yearly";
process.env.STRIPE_PRICE_LEAGUE_MONTHLY = "price_league_monthly";
process.env.STRIPE_PRICE_LEAGUE_YEARLY = "price_league_yearly";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.RESEND_API_KEY = "re_fake";

// Shared mocks
const updateUserMetadata = vi.fn();
const getUser = vi.fn().mockResolvedValue({ publicMetadata: {}, privateMetadata: {} });
const subscriptionsRetrieve = vi.fn();
const customersRetrieve = vi.fn();
const emailsSend = vi.fn().mockResolvedValue({ id: "email_123" });

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: {
      getUser,
      updateUserMetadata,
    },
  })),
}));

vi.mock("../stripe", () => ({
  getStripe: vi.fn(() => ({
    subscriptions: { retrieve: subscriptionsRetrieve },
    customers: { retrieve: customersRetrieve },
  })),
}));

vi.mock("../resend", () => ({
  getResend: vi.fn(() => ({
    emails: { send: emailsSend },
  })),
  getFromEmail: vi.fn(() => "billing@test.com"),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  getUser.mockResolvedValue({ publicMetadata: {}, privateMetadata: {} });
});

describe("handleCheckoutCompleted", () => {
  it("syncs tier to Clerk metadata when subscription has Plus monthly price", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ price: { id: "price_plus_monthly" } }] },
    });

    const { handleCheckoutCompleted } = await import("../stripe-webhook-handlers");

    await handleCheckoutCompleted({
      id: "cs_123",
      subscription: "sub_123",
      customer: "cus_123",
      client_reference_id: "user_abc",
      metadata: { clerkUserId: "user_abc" },
      customer_details: { email: "test@example.com" },
      amount_total: 499,
    } as never);

    expect(updateUserMetadata).toHaveBeenCalledWith(
      "user_abc",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({ tier: "plus", billingStatus: "active" }),
        privateMetadata: expect.objectContaining({ stripeCustomerId: "cus_123" }),
      }),
    );
  });

  it("ignores session without clerkUserId", async () => {
    const { handleCheckoutCompleted } = await import("../stripe-webhook-handlers");

    await handleCheckoutCompleted({
      id: "cs_456",
      subscription: "sub_456",
      customer: "cus_456",
      client_reference_id: null,
      metadata: {},
    } as never);

    expect(updateUserMetadata).not.toHaveBeenCalled();
  });

  it("ignores session when price does not map to a known tier", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      id: "sub_789",
      items: { data: [{ price: { id: "price_unknown" } }] },
    });

    const { handleCheckoutCompleted } = await import("../stripe-webhook-handlers");

    await handleCheckoutCompleted({
      id: "cs_789",
      subscription: "sub_789",
      customer: "cus_789",
      client_reference_id: "user_xyz",
      metadata: { clerkUserId: "user_xyz" },
    } as never);

    expect(updateUserMetadata).not.toHaveBeenCalled();
  });

  it("sends a receipt email when customer email is present", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      id: "sub_222",
      items: { data: [{ price: { id: "price_plus_monthly" } }] },
    });

    const { handleCheckoutCompleted } = await import("../stripe-webhook-handlers");

    await handleCheckoutCompleted({
      id: "cs_222",
      subscription: "sub_222",
      customer: "cus_222",
      client_reference_id: "user_222",
      metadata: { clerkUserId: "user_222" },
      customer_details: { email: "buyer@example.com" },
      amount_total: 499,
    } as never);

    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "buyer@example.com" }),
    );
  });
});

describe("handleSubscriptionDeleted", () => {
  it("resets tier to free", async () => {
    customersRetrieve.mockResolvedValue({
      id: "cus_999",
      deleted: false,
      metadata: { clerkUserId: "user_to_downgrade" },
    });

    const { handleSubscriptionDeleted } = await import("../stripe-webhook-handlers");

    await handleSubscriptionDeleted({
      id: "sub_del",
      customer: "cus_999",
      items: { data: [] },
    } as never);

    expect(updateUserMetadata).toHaveBeenCalledWith(
      "user_to_downgrade",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({ tier: "free" }),
      }),
    );
  });
});

describe("handleSubscriptionUpdated", () => {
  it("upgrades user from Plus to Club", async () => {
    customersRetrieve.mockResolvedValue({
      id: "cus_upgrade",
      deleted: false,
      metadata: { clerkUserId: "user_upgrade" },
    });

    const { handleSubscriptionUpdated } = await import("../stripe-webhook-handlers");

    await handleSubscriptionUpdated({
      id: "sub_upgrade",
      customer: "cus_upgrade",
      items: { data: [{ price: { id: "price_club_monthly" } }] },
    } as never);

    expect(updateUserMetadata).toHaveBeenCalledWith(
      "user_upgrade",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({ tier: "club" }),
      }),
    );
  });
});

describe("handlePaymentFailed", () => {
  it("sets billingStatus to past_due", async () => {
    customersRetrieve.mockResolvedValue({
      id: "cus_failed",
      deleted: false,
      metadata: { clerkUserId: "user_failed" },
    });

    const { handlePaymentFailed } = await import("../stripe-webhook-handlers");

    await handlePaymentFailed({
      id: "in_123",
      customer: "cus_failed",
      customer_email: "failed@example.com",
      amount_due: 499,
    } as never);

    expect(updateUserMetadata).toHaveBeenCalledWith(
      "user_failed",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({ billingStatus: "past_due" }),
      }),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env before any imports
process.env.CLERK_WEBHOOK_SIGNING_SECRET = "whsec_test_secret";
process.env.RESEND_API_KEY = "re_fake";

// Hoisted mocks so vi.mock factories can capture them safely
const { emailsSend, verifyMock } = vi.hoisted(() => ({
  emailsSend: vi.fn(),
  verifyMock: vi.fn(),
}));

vi.mock("../resend", () => ({
  getResend: vi.fn(() => ({
    emails: { send: emailsSend },
  })),
  getFromEmail: vi.fn(() => "welcome@test.com"),
}));

vi.mock("svix", () => ({
  Webhook: class {
    verify(body: string, headers: Record<string, string>) {
      return verifyMock(body, headers);
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  emailsSend.mockResolvedValue({ id: "email_123" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendWelcomeEmail", () => {
  it("uses first name in greeting when provided", async () => {
    const { sendWelcomeEmail } = await import("../emails/welcome");
    await sendWelcomeEmail({ to: "alice@example.com", firstName: "Alice" });
    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        subject: "Welcome to sprtsmng",
        html: expect.stringContaining("Hi Alice,"),
      }),
    );
  });

  it("falls back to 'Hi there' when first name is null", async () => {
    const { sendWelcomeEmail } = await import("../emails/welcome");
    await sendWelcomeEmail({ to: "bob@example.com", firstName: null });
    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Hi there,"),
      }),
    );
  });

  it("uses configured from address", async () => {
    const { sendWelcomeEmail } = await import("../emails/welcome");
    await sendWelcomeEmail({ to: "carol@example.com" });
    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "welcome@test.com" }),
    );
  });

  it("includes the dashboard CTA link", async () => {
    const { sendWelcomeEmail } = await import("../emails/welcome");
    await sendWelcomeEmail({ to: "dan@example.com" });
    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("https://sprtsmng.andrewsolomon.dev/dashboard"),
      }),
    );
  });
});

describe("Clerk webhook route", () => {
  it("returns 400 when svix headers are missing", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: "{}",
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it("returns 400 when signature verification throws", async () => {
    verifyMock.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });

    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "test",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,bad",
      },
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    expect(emailsSend).not.toHaveBeenCalled();
  });

  it("dispatches sendWelcomeEmail on user.created event", async () => {
    verifyMock.mockReturnValueOnce({
      type: "user.created",
      data: {
        id: "user_abc",
        first_name: "Eve",
        last_name: "Smith",
        email_addresses: [
          { id: "email_1", email_address: "eve@example.com" },
        ],
        primary_email_address_id: "email_1",
      },
    });

    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "test",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,signed",
      },
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "eve@example.com",
        html: expect.stringContaining("Hi Eve,"),
      }),
    );
  });

  it("ignores non-user.created event types", async () => {
    verifyMock.mockReturnValueOnce({
      type: "user.updated",
      data: {
        id: "user_xyz",
        first_name: "Frank",
        last_name: null,
        email_addresses: [
          { id: "email_1", email_address: "frank@example.com" },
        ],
        primary_email_address_id: "email_1",
      },
    });

    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "test",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,signed",
      },
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(emailsSend).not.toHaveBeenCalled();
  });

  it("falls back to first email when primary_email_address_id is null", async () => {
    verifyMock.mockReturnValueOnce({
      type: "user.created",
      data: {
        id: "user_no_primary",
        first_name: "Gina",
        last_name: null,
        email_addresses: [
          { id: "email_1", email_address: "gina@example.com" },
          { id: "email_2", email_address: "second@example.com" },
        ],
        primary_email_address_id: null,
      },
    });

    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "test",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,signed",
      },
      body: JSON.stringify({}),
    });
    await POST(request as never);
    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "gina@example.com" }),
    );
  });

  it("returns 200 even when sendWelcomeEmail throws (no Clerk retry)", async () => {
    verifyMock.mockReturnValueOnce({
      type: "user.created",
      data: {
        id: "user_resend_fail",
        first_name: "Henry",
        last_name: null,
        email_addresses: [
          { id: "email_1", email_address: "henry@example.com" },
        ],
        primary_email_address_id: "email_1",
      },
    });
    emailsSend.mockRejectedValueOnce(new Error("Resend rate limit"));

    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "test",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,signed",
      },
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
  });
});

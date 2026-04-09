import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

import { auth, clerkClient } from "@clerk/nextjs/server";
import { GET } from "../route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockClerkClient = clerkClient as unknown as ReturnType<typeof vi.fn>;

function setupUser(opts: {
  userId: string;
  tier?: string;
  email?: string | null;
}) {
  mockClerkClient.mockResolvedValue({
    users: {
      getUser: vi.fn().mockResolvedValue({
        publicMetadata: opts.tier ? { tier: opts.tier } : {},
        primaryEmailAddress:
          opts.email === null
            ? null
            : { emailAddress: opts.email ?? "test@example.com" },
      }),
    },
  });
}

describe("GET /api/cli/whoami", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    mockAuth.mockResolvedValue({ userId: null, tokenType: null });

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  it("returns user info for a session-authenticated request", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_session_123",
      tokenType: "session_token",
    });
    setupUser({ userId: "user_session_123", tier: "plus" });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      userId: "user_session_123",
      email: "test@example.com",
      tier: "plus",
      authMethod: "session_token",
    });
  });

  it("returns user info for an API-key-authenticated request", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_apikey_456",
      tokenType: "api_key",
    });
    setupUser({ userId: "user_apikey_456", tier: "free" });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authMethod).toBe("api_key");
    expect(body.userId).toBe("user_apikey_456");
    expect(body.tier).toBe("free");
  });

  it("defaults tier to 'free' when publicMetadata.tier is unset", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_notier_789",
      tokenType: "session_token",
    });
    setupUser({ userId: "user_notier_789" });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe("free");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSyncNfl = vi.fn();
const mockWaitUntil = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: (p: Promise<unknown>) => mockWaitUntil(p),
}));

vi.mock("@/lib/sync/nfl-sync", () => ({
  syncNfl: (...args: unknown[]) => mockSyncNfl(...args),
}));

import { POST } from "../nfl-sync/route";

describe("POST /api/import/nfl-sync (WSM-000084)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncNfl.mockResolvedValue({ adapterErrors: [] });
  });

  it("returns 401 without a user", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST();
    expect(res.status).toBe(401);
    expect(mockSyncNfl).not.toHaveBeenCalled();
  });

  it("returns 202 with requestedAt immediately and runs the sync in the background", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    // Never-resolving sync — the response must not wait for it.
    mockSyncNfl.mockReturnValue(new Promise(() => {}));

    const res = await POST();

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(new Date(body.requestedAt).toString()).not.toBe("Invalid Date");
    expect(mockSyncNfl).toHaveBeenCalledWith({ skipToggleCheck: true });
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
  });

  it("swallows background sync failures without rejecting the handed-off promise", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    mockSyncNfl.mockRejectedValue(new Error("ESPN unreachable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST();
    expect(res.status).toBe(202);

    // The promise handed to waitUntil must resolve (not reject) on failure.
    await expect(mockWaitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

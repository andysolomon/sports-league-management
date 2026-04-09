import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchLeagues } from "../lib/api.js";
import { apiTracker } from "../lib/api-tracker.js";
import { errorTracker } from "../lib/error-tracker.js";

describe("instrumentedFetch error handling", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    apiTracker.clear();
    errorTracker.clear();
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  it("succeeds on first attempt with no retry", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: "lg1", name: "Test" }]),
    }) as unknown as typeof fetch;

    const result = await fetchLeagues("http://test.local", "ak_test");
    expect(result).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("retries once on network error and succeeds", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("ECONNREFUSED");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
    }) as unknown as typeof fetch;

    const result = await fetchLeagues("http://test.local", "ak_test");
    expect(result).toEqual([]);
    expect(callCount).toBe(2); // original + 1 retry
  });

  it("throws actionable message after retry also fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(
      new Error("ECONNREFUSED"),
    ) as unknown as typeof fetch;

    await expect(fetchLeagues("http://test.local", "ak_test")).rejects.toThrow(
      "Cannot reach the server at http://test.local",
    );

    // Error should be recorded
    const errors = errorTracker.getRecent();
    expect(errors).toHaveLength(1);
    expect(errors[0].status).toBe(0);
  });

  it("throws re-login message on 401 without retry", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      clone: () => ({
        json: () => Promise.resolve({ error: "unauthorized" }),
      }),
    }) as unknown as typeof fetch;

    await expect(fetchLeagues("http://test.local", "ak_test")).rejects.toThrow(
      "Run 'pnpm tui login' to re-authenticate",
    );
    expect(global.fetch).toHaveBeenCalledOnce(); // no retry on 401
  });

  it("extracts BFF error message on 503", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      clone: () => ({
        json: () =>
          Promise.resolve({
            message: "Salesforce connection timeout",
          }),
      }),
    }) as unknown as typeof fetch;

    await expect(fetchLeagues("http://test.local", "ak_test")).rejects.toThrow(
      "Salesforce connection timeout",
    );
  });

  it("falls back to status text when no BFF message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      clone: () => ({
        json: () => Promise.reject(new Error("not json")),
      }),
    }) as unknown as typeof fetch;

    await expect(fetchLeagues("http://test.local", "ak_test")).rejects.toThrow(
      "500 Internal Server Error",
    );
  });
});

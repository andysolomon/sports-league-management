import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock readline before importing login
vi.mock("node:readline/promises", () => ({
  createInterface: vi.fn(),
}));

import { createInterface } from "node:readline/promises";
import { runLogin } from "../commands/login.js";

const mockCreateInterface = createInterface as unknown as ReturnType<
  typeof vi.fn
>;

function mockReadline(answer: string) {
  mockCreateInterface.mockReturnValue({
    question: vi.fn().mockResolvedValue(answer),
    close: vi.fn(),
  });
}

const validWhoamiResponse = {
  userId: "user_test_123",
  email: "test@example.com",
  tier: "free",
  authMethod: "api_key",
};

describe("runLogin", () => {
  let tmpDir: string;
  const originalXdg = process.env.XDG_CONFIG_HOME;
  const originalUrl = process.env.SPRTSMNG_API_URL;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "sprtsmng-login-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.SPRTSMNG_API_URL = "http://test-api.local";
    vi.clearAllMocks();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    if (originalUrl === undefined) delete process.env.SPRTSMNG_API_URL;
    else process.env.SPRTSMNG_API_URL = originalUrl;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes credentials on successful verification", async () => {
    mockReadline("ak_VALID_KEY");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validWhoamiResponse),
    }) as unknown as typeof fetch;

    await runLogin();

    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-api.local/api/cli/whoami",
      { headers: { Authorization: "Bearer ak_VALID_KEY" } },
    );

    const raw = await readFile(
      join(tmpDir, "sprtsmng", "auth.json"),
      "utf8",
    );
    const creds = JSON.parse(raw);
    expect(creds.apiKey).toBe("ak_VALID_KEY");
    expect(creds.userId).toBe("user_test_123");
    expect(creds.email).toBe("test@example.com");
    expect(creds.createdAt).toBeDefined();
  });

  it("throws on 401 and does not write credentials", async () => {
    mockReadline("ak_INVALID");
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    }) as unknown as typeof fetch;

    await expect(runLogin()).rejects.toThrow("Run 'pnpm tui login' to re-authenticate");

    // auth.json should not exist
    const { readCredentials } = await import("../lib/credentials.js");
    const loaded = await readCredentials();
    expect(loaded).toBeNull();
  });

  it("throws on empty input", async () => {
    mockReadline("");
    await expect(runLogin()).rejects.toThrow("No API key provided");
  });

  it("trims whitespace from pasted key", async () => {
    mockReadline("  ak_PADDED_KEY  ");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validWhoamiResponse),
    }) as unknown as typeof fetch;

    await runLogin();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer ak_PADDED_KEY" },
      }),
    );
  });
});

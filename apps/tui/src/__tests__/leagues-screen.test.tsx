import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ScreenProvider } from "../hooks/useScreen.js";
import { LeaguesScreen } from "../screens/LeaguesScreen.js";

vi.mock("../lib/credentials.js", () => ({
  readCredentials: vi.fn(),
}));
vi.mock("../lib/config.js", () => ({
  getApiBaseUrl: vi.fn().mockReturnValue("http://test.local"),
}));

import { readCredentials } from "../lib/credentials.js";

const mockReadCredentials = readCredentials as unknown as ReturnType<
  typeof vi.fn
>;

function renderScreen() {
  return render(
    <ScreenProvider initialScreen="leagues">
      <LeaguesScreen />
    </ScreenProvider>,
  );
}

describe("LeaguesScreen", () => {
  const originalFetch = global.fetch;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows loading state initially", () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "user_1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;

    const { lastFrame } = renderScreen();
    expect(lastFrame()).toContain("Loading leagues...");
  });

  it("shows error when not authenticated", async () => {
    mockReadCredentials.mockResolvedValue(null);

    const { lastFrame } = renderScreen();
    // Wait for the async effect
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("Not authenticated");
  });

  it("renders league list after successful fetch", async () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "user_1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "lg_1", name: "Premier League" },
          { id: "lg_2", name: "La Liga" },
        ]),
    }) as unknown as typeof fetch;

    const { lastFrame } = renderScreen();
    await new Promise((r) => setTimeout(r, 50));

    const frame = lastFrame()!;
    expect(frame).toContain("Premier League");
    expect(frame).toContain("La Liga");
    expect(frame).toContain("Leagues (2)");
  });

  it("shows error on API failure", async () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "user_1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    }) as unknown as typeof fetch;

    const { lastFrame } = renderScreen();
    await new Promise((r) => setTimeout(r, 50));

    expect(lastFrame()).toContain("Error");
    expect(lastFrame()).toContain("503");
  });

  it("selects the first row by default", async () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "user_1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "lg_1", name: "Premier League" },
          { id: "lg_2", name: "La Liga" },
        ]),
    }) as unknown as typeof fetch;

    const { lastFrame } = renderScreen();
    await new Promise((r) => setTimeout(r, 50));

    // First row should have the cursor indicator
    expect(lastFrame()).toContain("❯");
  });
});

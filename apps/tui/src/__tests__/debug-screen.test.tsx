import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ScreenProvider } from "../hooks/useScreen.js";
import { DebugScreen } from "../screens/DebugScreen.js";
import { apiTracker } from "../lib/api-tracker.js";

vi.mock("../lib/credentials.js", () => ({
  readCredentials: vi.fn(),
}));

import { readCredentials } from "../lib/credentials.js";
const mockCreds = readCredentials as unknown as ReturnType<typeof vi.fn>;

function renderDebug() {
  return render(
    <ScreenProvider initialScreen="debug">
      <DebugScreen />
    </ScreenProvider>,
  );
}

describe("DebugScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiTracker.clear();
  });

  it("shows 'Not authenticated' when no credentials", async () => {
    mockCreds.mockResolvedValue(null);
    const { lastFrame } = renderDebug();
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("Not authenticated");
  });

  it("shows token state when credentials exist", async () => {
    mockCreds.mockResolvedValue({
      apiKey: "ak_test",
      userId: "user_1",
      email: "dev@test.com",
      createdAt: "2026-04-09T00:00:00.000Z",
    });
    const { lastFrame } = renderDebug();
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("dev@test.com");
    expect(lastFrame()).toContain("2026-04-09");
  });

  it("shows 'No API calls recorded' when tracker is empty", async () => {
    mockCreds.mockResolvedValue(null);
    const { lastFrame } = renderDebug();
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("No API calls recorded");
  });

  it("renders recent API calls", async () => {
    mockCreds.mockResolvedValue(null);
    apiTracker.record({
      method: "GET",
      path: "/api/cli/leagues",
      status: 200,
      durationMs: 142,
      timestamp: "2026-04-09T12:34:56.789Z",
    });
    const { lastFrame } = renderDebug();
    await new Promise((r) => setTimeout(r, 50));
    const frame = lastFrame()!;
    expect(frame).toContain("GET");
    expect(frame).toContain("/api/cli/leagues");
    expect(frame).toContain("200");
    expect(frame).toContain("142ms");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ScreenProvider } from "../hooks/useScreen.js";
import { SeasonsScreen } from "../screens/SeasonsScreen.js";

vi.mock("../lib/credentials.js", () => ({ readCredentials: vi.fn() }));
vi.mock("../lib/config.js", () => ({ getApiBaseUrl: vi.fn().mockReturnValue("http://test.local") }));

import { readCredentials } from "../lib/credentials.js";
const mockCreds = readCredentials as unknown as ReturnType<typeof vi.fn>;

const creds = { apiKey: "ak_test", userId: "u1", email: "t@e.com", createdAt: "2026-01-01" };

function renderScreen() {
  return render(
    <ScreenProvider initialScreen="seasons">
      <SeasonsScreen />
    </ScreenProvider>,
  );
}

describe("SeasonsScreen", () => {
  const origFetch = global.fetch;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { global.fetch = origFetch; });

  it("shows loading state", () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    expect(renderScreen().lastFrame()).toContain("Loading seasons");
  });

  it("renders season list with dates", async () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: "s1", name: "2025-26", leagueId: "lg1", startDate: "2025-08-01", endDate: "2026-05-31", status: "Active" },
      ]),
    }) as unknown as typeof fetch;

    const { lastFrame } = renderScreen();
    await new Promise((r) => setTimeout(r, 50));
    const frame = lastFrame()!;
    expect(frame).toContain("2025-26");
    expect(frame).toContain("2025-08-01");
    expect(frame).toContain("2026-05-31");
  });

  it("shows empty state", async () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }) as unknown as typeof fetch;
    const { lastFrame } = renderScreen();
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("No seasons found");
  });
});

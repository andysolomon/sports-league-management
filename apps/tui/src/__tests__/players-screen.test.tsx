import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ScreenProvider } from "../hooks/useScreen.js";
import { PlayersScreen } from "../screens/PlayersScreen.js";

vi.mock("../lib/credentials.js", () => ({ readCredentials: vi.fn() }));
vi.mock("../lib/config.js", () => ({ getApiBaseUrl: vi.fn().mockReturnValue("http://test.local") }));

import { readCredentials } from "../lib/credentials.js";
const mockCreds = readCredentials as unknown as ReturnType<typeof vi.fn>;

const creds = { apiKey: "ak_test", userId: "u1", email: "t@e.com", createdAt: "2026-01-01" };

function renderScreen() {
  return render(
    <ScreenProvider initialScreen="players" initialParams={{ teamId: "t1", teamName: "Arsenal" }}>
      <PlayersScreen />
    </ScreenProvider>,
  );
}

describe("PlayersScreen", () => {
  const origFetch = global.fetch;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { global.fetch = origFetch; });

  it("shows loading state", () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    expect(renderScreen().lastFrame()).toContain("Loading players");
  });

  it("renders player list", async () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: "p1", name: "Saka", position: "RW", jerseyNumber: 7, status: "Active", teamId: "t1", dateOfBirth: null },
      ]),
    }) as unknown as typeof fetch;

    const { lastFrame } = renderScreen();
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("Saka");
    expect(lastFrame()).toContain("RW");
    expect(lastFrame()).toContain("#7");
  });

  it("shows empty state", async () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }) as unknown as typeof fetch;
    const { lastFrame } = renderScreen();
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("No players in Arsenal");
  });

  it("shows error on failure", async () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Unavailable" }) as unknown as typeof fetch;
    const { lastFrame } = renderScreen();
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("Error");
  });
});

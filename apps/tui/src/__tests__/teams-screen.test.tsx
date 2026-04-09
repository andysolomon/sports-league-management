import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ScreenProvider } from "../hooks/useScreen.js";
import { TeamsScreen } from "../screens/TeamsScreen.js";

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

function renderTeamsScreen() {
  return render(
    <ScreenProvider
      initialScreen="teams"
      initialParams={{ leagueId: "lg_1", leagueName: "Premier League" }}
    >
      <TeamsScreen />
    </ScreenProvider>,
  );
}

describe("TeamsScreen", () => {
  const originalFetch = global.fetch;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows loading state initially", () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "u1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockReturnValue(
      new Promise(() => {}),
    ) as unknown as typeof fetch;

    const { lastFrame } = renderTeamsScreen();
    expect(lastFrame()).toContain("Loading teams");
    expect(lastFrame()).toContain("Premier League");
  });

  it("renders team list with name, city, stadium", async () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "u1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "t1",
            name: "Arsenal",
            city: "London",
            stadium: "Emirates Stadium",
            leagueId: "lg_1",
            foundedYear: 1886,
            location: "N5",
            divisionId: "d1",
          },
          {
            id: "t2",
            name: "Chelsea",
            city: "London",
            stadium: "Stamford Bridge",
            leagueId: "lg_1",
            foundedYear: 1905,
            location: "SW6",
            divisionId: "d1",
          },
        ]),
    }) as unknown as typeof fetch;

    const { lastFrame } = renderTeamsScreen();
    await new Promise((r) => setTimeout(r, 50));

    const frame = lastFrame()!;
    expect(frame).toContain("Arsenal");
    expect(frame).toContain("Chelsea");
    expect(frame).toContain("London");
    expect(frame).toContain("Emirates Stadium");
    expect(frame).toContain("Teams in Premier League (2)");
  });

  it("shows empty state when no teams", async () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "u1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as typeof fetch;

    const { lastFrame } = renderTeamsScreen();
    await new Promise((r) => setTimeout(r, 50));

    expect(lastFrame()).toContain("No teams in Premier League");
  });

  it("shows error on API failure", async () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "u1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    }) as unknown as typeof fetch;

    const { lastFrame } = renderTeamsScreen();
    await new Promise((r) => setTimeout(r, 50));

    expect(lastFrame()).toContain("Error");
    expect(lastFrame()).toContain("503");
  });

  it("passes leagueId to the API call", async () => {
    mockReadCredentials.mockResolvedValue({
      apiKey: "ak_test",
      userId: "u1",
      email: "test@example.com",
      createdAt: "2026-01-01",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as typeof fetch;

    renderTeamsScreen();
    await new Promise((r) => setTimeout(r, 50));

    expect(global.fetch).toHaveBeenCalledWith(
      "http://test.local/api/cli/teams?leagueId=lg_1",
      expect.objectContaining({
        headers: { Authorization: "Bearer ak_test" },
      }),
    );
  });
});

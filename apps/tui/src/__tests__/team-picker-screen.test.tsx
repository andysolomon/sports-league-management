import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ScreenProvider } from "../hooks/useScreen.js";
import { TeamPickerScreen } from "../screens/TeamPickerScreen.js";

vi.mock("../lib/credentials.js", () => ({ readCredentials: vi.fn() }));
vi.mock("../lib/config.js", () => ({
  getApiBaseUrl: vi.fn().mockReturnValue("http://test.local"),
}));

import { readCredentials } from "../lib/credentials.js";
const mockCreds = readCredentials as unknown as ReturnType<typeof vi.fn>;

const creds = { apiKey: "ak_test", userId: "u1", email: "t@e.com", createdAt: "2026-01-01" };

function renderPicker() {
  return render(
    <ScreenProvider
      initialScreen="team-picker"
      initialParams={{
        playerIds: ["p1", "p2"],
        playerNames: ["Saka", "Odegaard"],
        leagueId: "lg1",
      }}
    >
      <TeamPickerScreen />
    </ScreenProvider>,
  );
}

describe("TeamPickerScreen", () => {
  const origFetch = global.fetch;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { global.fetch = origFetch; });

  it("shows loading state initially", () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    expect(renderPicker().lastFrame()).toContain("Loading teams");
  });

  it("shows team list for picking", async () => {
    mockCreds.mockResolvedValue(creds);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: "t1", name: "Arsenal", city: "London", stadium: "Emirates", leagueId: "lg1", foundedYear: null, location: "", divisionId: "" },
        { id: "t2", name: "Chelsea", city: "London", stadium: "Stamford Bridge", leagueId: "lg1", foundedYear: null, location: "", divisionId: "" },
      ]),
    }) as unknown as typeof fetch;

    const { lastFrame } = renderPicker();
    await new Promise((r) => setTimeout(r, 50));
    const frame = lastFrame()!;
    expect(frame).toContain("Arsenal");
    expect(frame).toContain("Chelsea");
    expect(frame).toContain("2 player");
  });
});

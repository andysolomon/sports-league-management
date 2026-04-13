import { describe, it, expect, vi, beforeEach } from "vitest";
import { EspnNflAdapter } from "../espn-nfl";
import groupsFixture from "../__fixtures__/espn-groups.json";
import teamsFixture from "../__fixtures__/espn-teams.json";
import teamDetail2 from "../__fixtures__/espn-team-detail-2.json";
import teamDetail15 from "../__fixtures__/espn-team-detail-15.json";
import teamDetail25 from "../__fixtures__/espn-team-detail-25.json";
import roster2 from "../__fixtures__/espn-roster-2.json";
import roster15 from "../__fixtures__/espn-roster-15.json";
import roster25 from "../__fixtures__/espn-roster-25.json";

const teamDetails: Record<string, unknown> = {
  "2": teamDetail2,
  "15": teamDetail15,
  "25": teamDetail25,
};

const rosters: Record<string, unknown> = {
  "2": roster2,
  "15": roster15,
  "25": roster25,
};

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockFetchResponses() {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/groups")) {
      return { ok: true, json: async () => groupsFixture };
    }
    if (url.includes("/teams/") && url.includes("/roster")) {
      const id = url.match(/teams\/(\d+)\/roster/)?.[1];
      return { ok: true, json: async () => rosters[id!] ?? { athletes: [] } };
    }
    if (url.match(/teams\/\d+$/)) {
      const id = url.match(/teams\/(\d+)$/)?.[1];
      return { ok: true, json: async () => teamDetails[id!] };
    }
    if (url.includes("/teams")) {
      return { ok: true, json: async () => teamsFixture };
    }
    return { ok: false, status: 404 };
  });
}

describe("EspnNflAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResponses();
  });

  it("returns NFL league with correct name", async () => {
    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();
    expect(result.league.name).toBe("NFL");
  });

  it("maps divisions from groups endpoint", async () => {
    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();
    const divNames = result.divisions.map((d) => d.name);
    expect(divNames).toContain("AFC East");
    expect(divNames).toContain("NFC West");
    expect(result.divisions).toHaveLength(2);
  });

  it("maps teams within divisions", async () => {
    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();

    const afcEast = result.divisions.find((d) => d.name === "AFC East")!;
    expect(afcEast.teams).toHaveLength(2);
    expect(afcEast.teams[0].name).toBe("Buffalo Bills");
    expect(afcEast.teams[1].name).toBe("Miami Dolphins");

    const nfcWest = result.divisions.find((d) => d.name === "NFC West")!;
    expect(nfcWest.teams).toHaveLength(1);
    expect(nfcWest.teams[0].name).toBe("San Francisco 49ers");
  });

  it("maps team city, stadium, and logo URL", async () => {
    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();

    const bills = result.divisions
      .find((d) => d.name === "AFC East")!
      .teams.find((t) => t.name === "Buffalo Bills")!;

    expect(bills.city).toBe("Buffalo");
    expect(bills.stadium).toBe("Highmark Stadium");
    expect(bills.logoUrl).toBe(
      "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
    );
  });

  it("maps players from roster with all fields", async () => {
    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();

    const bills = result.divisions
      .find((d) => d.name === "AFC East")!
      .teams.find((t) => t.name === "Buffalo Bills")!;

    expect(bills.players).toHaveLength(3); // 2 offense + 1 defense

    const allen = bills.players.find((p) => p.name === "Josh Allen")!;
    expect(allen.position).toBe("QB");
    expect(allen.jerseyNumber).toBe(17);
    expect(allen.dateOfBirth).toBe("1996-05-21");
    expect(allen.status).toBe("Active");
    expect(allen.headshotUrl).toBe(
      "https://a.espncdn.com/i/headshots/nfl/players/full/3918298.png",
    );
  });

  it("flattens offense and defense roster groups", async () => {
    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();

    const bills = result.divisions
      .find((d) => d.name === "AFC East")!
      .teams.find((t) => t.name === "Buffalo Bills")!;

    const positions = bills.players.map((p) => p.position);
    expect(positions).toContain("QB");
    expect(positions).toContain("RB");
    expect(positions).toContain("DT");
  });

  it("maps Injured Reserve status", async () => {
    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();

    const dolphins = result.divisions
      .find((d) => d.name === "AFC East")!
      .teams.find((t) => t.name === "Miami Dolphins")!;

    const phillips = dolphins.players.find(
      (p) => p.name === "Jaelan Phillips",
    )!;
    expect(phillips.status).toBe("Injured Reserve");
  });

  it("handles roster fetch failure gracefully", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/groups")) {
        return { ok: true, json: async () => groupsFixture };
      }
      if (url.includes("/roster")) {
        return { ok: false, status: 500 };
      }
      if (url.match(/teams\/\d+$/)) {
        const id = url.match(/teams\/(\d+)$/)?.[1];
        return { ok: true, json: async () => teamDetails[id!] };
      }
      if (url.includes("/teams")) {
        return { ok: true, json: async () => teamsFixture };
      }
      return { ok: false, status: 404 };
    });

    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();

    // Teams still present, just with empty rosters
    const bills = result.divisions
      .find((d) => d.name === "AFC East")!
      .teams.find((t) => t.name === "Buffalo Bills")!;
    expect(bills.players).toHaveLength(0);
  });

  it("handles team detail fetch failure gracefully", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/groups")) {
        return { ok: true, json: async () => groupsFixture };
      }
      if (url.match(/teams\/\d+$/) && url.includes("/2")) {
        return { ok: false, status: 500 };
      }
      if (url.match(/teams\/\d+$/)) {
        const id = url.match(/teams\/(\d+)$/)?.[1];
        return { ok: true, json: async () => teamDetails[id!] };
      }
      if (url.includes("/roster")) {
        const id = url.match(/teams\/(\d+)\/roster/)?.[1];
        return { ok: true, json: async () => rosters[id!] ?? { athletes: [] } };
      }
      if (url.includes("/teams")) {
        return { ok: true, json: async () => teamsFixture };
      }
      return { ok: false, status: 404 };
    });

    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();

    // Bills still present with empty stadium
    const bills = result.divisions
      .find((d) => d.name === "AFC East")!
      .teams.find((t) => t.name === "Buffalo Bills")!;
    expect(bills.stadium).toBe("");
  });

  it("strips time portion from dateOfBirth", async () => {
    const adapter = new EspnNflAdapter();
    const result = await adapter.fetchLeagueData();

    const bills = result.divisions
      .find((d) => d.name === "AFC East")!
      .teams.find((t) => t.name === "Buffalo Bills")!;

    for (const player of bills.players) {
      if (player.dateOfBirth) {
        expect(player.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

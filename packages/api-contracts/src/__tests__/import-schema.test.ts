import { describe, it, expect } from "vitest";
import { LeagueImportSchema } from "../import-schema.js";

const validPayload = {
  league: { name: "NFL" },
  divisions: [
    {
      name: "NFC East",
      teams: [
        {
          name: "Dallas Cowboys",
          city: "Dallas",
          stadium: "AT&T Stadium",
          players: [
            { name: "Dak Prescott", position: "QB", jerseyNumber: 4 },
            { name: "CeeDee Lamb", position: "WR", jerseyNumber: 88, status: "Active" },
          ],
        },
        {
          name: "Philadelphia Eagles",
          city: "Philadelphia",
          stadium: "Lincoln Financial Field",
        },
      ],
    },
    {
      name: "AFC East",
      teams: [
        {
          name: "New England Patriots",
          city: "Foxborough",
          stadium: "Gillette Stadium",
          players: [
            { name: "Drake Maye", position: "QB", jerseyNumber: 10, dateOfBirth: "2002-09-30" },
          ],
        },
      ],
    },
  ],
};

describe("LeagueImportSchema", () => {
  it("accepts a valid nested payload", () => {
    const result = LeagueImportSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.league.name).toBe("NFL");
      expect(result.data.divisions).toHaveLength(2);
      expect(result.data.divisions[0].teams).toHaveLength(2);
      expect(result.data.divisions[0].teams[0].players).toHaveLength(2);
    }
  });

  it("defaults player status to Active when omitted", () => {
    const result = LeagueImportSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      const player = result.data.divisions[0].teams[0].players[0];
      expect(player.status).toBe("Active");
    }
  });

  it("defaults players to empty array when omitted", () => {
    const result = LeagueImportSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      const eagles = result.data.divisions[0].teams[1];
      expect(eagles.players).toEqual([]);
    }
  });

  it("rejects when league name is missing", () => {
    const result = LeagueImportSchema.safeParse({
      league: { name: "" },
      divisions: validPayload.divisions,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when league object is missing", () => {
    const result = LeagueImportSchema.safeParse({
      divisions: validPayload.divisions,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when divisions array is empty", () => {
    const result = LeagueImportSchema.safeParse({
      league: { name: "NFL" },
      divisions: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(", ");
      expect(msg).toContain("At least one division is required");
    }
  });

  it("rejects when a division has no teams", () => {
    const result = LeagueImportSchema.safeParse({
      league: { name: "NFL" },
      divisions: [{ name: "NFC East", teams: [] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(", ");
      expect(msg).toContain("Each division must have at least one team");
    }
  });

  it("rejects when team is missing required fields", () => {
    const result = LeagueImportSchema.safeParse({
      league: { name: "NFL" },
      divisions: [
        {
          name: "NFC East",
          teams: [{ name: "Cowboys" }], // missing city + stadium
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("divisions.0.teams.0.city");
      expect(paths).toContain("divisions.0.teams.0.stadium");
    }
  });

  it("rejects when player is missing required fields", () => {
    const result = LeagueImportSchema.safeParse({
      league: { name: "NFL" },
      divisions: [
        {
          name: "NFC East",
          teams: [
            {
              name: "Cowboys",
              city: "Dallas",
              stadium: "AT&T Stadium",
              players: [{ name: "" }], // empty name + missing position
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("divisions.0.teams.0.players.0.name");
      expect(paths).toContain("divisions.0.teams.0.players.0.position");
    }
  });

  it("collects multiple errors across the tree", () => {
    const result = LeagueImportSchema.safeParse({
      league: { name: "" },
      divisions: [
        {
          name: "",
          teams: [
            {
              name: "",
              city: "",
              stadium: "AT&T Stadium",
              players: [{ name: "", position: "" }],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should have errors for: league.name, divisions[0].name, team.name, team.city, player.name, player.position
      expect(result.error.issues.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("strips unknown fields", () => {
    const result = LeagueImportSchema.safeParse({
      league: { name: "NFL", unknown: "field" },
      divisions: [
        {
          name: "NFC East",
          extra: true,
          teams: [
            {
              name: "Cowboys",
              city: "Dallas",
              stadium: "AT&T Stadium",
              foo: "bar",
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.league as Record<string, unknown>)["unknown"]).toBeUndefined();
    }
  });
});

/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

async function seedTeam(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "L",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", { name: "D", leagueId });
    return ctx.db.insert("teams", {
      name: "Allatoona",
      leagueId,
      divisionId,
      city: "Acworth",
      stadium: "Stadium",
      foundedYear: null,
      location: "Acworth",
      logoUrl: null,
      rosterLimit: 53,
    });
  });
}

describe("team identity (WSM-000134)", () => {
  it("persists teamName, logoUrl, and colors via updateTeam", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t);

    const dto = await t.mutation(internal.sports.updateTeam, {
      teamId,
      teamName: "Buccaneers",
      logoUrl: "https://example.com/logo.png",
      primaryColor: "#1e3a8a",
      secondaryColor: "#fbbf24",
    });

    expect(dto?.name).toBe("Allatoona");
    expect(dto?.teamName).toBe("Buccaneers");
    expect(dto?.logoUrl).toBe("https://example.com/logo.png");
    expect(dto?.primaryColor).toBe("#1e3a8a");
    expect(dto?.secondaryColor).toBe("#fbbf24");
  });

  it("defaults identity fields to null and can clear them", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t);

    // Defaults null on a fresh team.
    const before = await t.run((ctx) => ctx.db.get(teamId));
    expect(before?.teamName ?? null).toBeNull();

    // Set then clear.
    await t.mutation(internal.sports.updateTeam, {
      teamId,
      teamName: "Bucs",
      primaryColor: "#1e3a8a",
    });
    const cleared = await t.mutation(internal.sports.updateTeam, {
      teamId,
      teamName: null,
      primaryColor: null,
      secondaryColor: null,
    });
    expect(cleared?.teamName).toBeNull();
    expect(cleared?.primaryColor).toBeNull();
  });
});

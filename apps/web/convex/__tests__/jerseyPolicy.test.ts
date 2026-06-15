/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

/**
 * Seed a league with one team. `allowDuplicateJerseys` controls the team's
 * jersey policy (WSM-000125); leave it undefined to exercise the allow-by-
 * default path.
 */
async function seedTeam(
  t: ReturnType<typeof convexTest>,
  allowDuplicateJerseys?: boolean,
): Promise<Id<"teams">> {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Jersey League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", {
      name: "Div 1",
      leagueId,
    });
    return ctx.db.insert("teams", {
      name: "Team A",
      leagueId,
      divisionId,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "Loc",
      logoUrl: null,
      rosterLimit: 53,
      ...(allowDuplicateJerseys !== undefined
        ? { allowDuplicateJerseys }
        : {}),
    });
  });
}

describe("jersey policy (WSM-000125)", () => {
  it("defaults allowDuplicateJerseys to true in the team DTO", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t); // no policy set
    const dto = await t.query(api.sports.getTeam, { teamId });
    expect(dto?.allowDuplicateJerseys).toBe(true);
  });

  it("createTeam returns a team that allows duplicates by default", async () => {
    const t = convexTest(schema, modules);
    const leagueId = await t.run((ctx) =>
      ctx.db.insert("leagues", {
        name: "L2",
        orgId: "org_1",
        isPublic: false,
        inviteToken: null,
      }),
    );
    const team = await t.mutation(internal.sports.createTeam, {
      name: "New Team",
      leagueId,
      city: "C",
      stadium: "S",
    });
    expect(team.allowDuplicateJerseys).toBe(true);
  });

  it("updateTeam persists the allowDuplicateJerseys toggle", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t); // default true
    const off = await t.mutation(internal.sports.updateTeam, {
      teamId,
      allowDuplicateJerseys: false,
    });
    expect(off?.allowDuplicateJerseys).toBe(false);
    const on = await t.mutation(internal.sports.updateTeam, {
      teamId,
      allowDuplicateJerseys: true,
    });
    expect(on?.allowDuplicateJerseys).toBe(true);
  });

  it("allows a duplicate jersey when policy is ON (default)", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t, true);
    await t.mutation(internal.sports.createPlayer, {
      name: "First",
      teamId,
      position: "QB",
      jerseyNumber: 12,
      dateOfBirth: null,
      status: "Active",
    });
    // Same number, allowed.
    const second = await t.mutation(internal.sports.createPlayer, {
      name: "Second",
      teamId,
      position: "WR",
      jerseyNumber: 12,
      dateOfBirth: null,
      status: "Active",
    });
    expect(second.jerseyNumber).toBe(12);
  });

  it("blocks a duplicate jersey on createPlayer when policy is OFF", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t, false);
    await t.mutation(internal.sports.createPlayer, {
      name: "First",
      teamId,
      position: "QB",
      jerseyNumber: 7,
      dateOfBirth: null,
      status: "Active",
    });
    await expect(
      t.mutation(internal.sports.createPlayer, {
        name: "Second",
        teamId,
        position: "RB",
        jerseyNumber: 7,
        dateOfBirth: null,
        status: "Active",
      }),
    ).rejects.toThrow(/duplicate_jersey:7/);
  });

  it("blocks a duplicate jersey on updatePlayer when policy is OFF", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t, false);
    await t.mutation(internal.sports.createPlayer, {
      name: "First",
      teamId,
      position: "QB",
      jerseyNumber: 5,
      dateOfBirth: null,
      status: "Active",
    });
    const second = await t.mutation(internal.sports.createPlayer, {
      name: "Second",
      teamId,
      position: "RB",
      jerseyNumber: 22,
      dateOfBirth: null,
      status: "Active",
    });
    await expect(
      t.mutation(internal.sports.updatePlayer, {
        playerId: second.id as Id<"players">,
        jerseyNumber: 5,
      }),
    ).rejects.toThrow(/duplicate_jersey:5/);
  });

  it("lets a player keep its own number on updatePlayer when policy is OFF", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t, false);
    const player = await t.mutation(internal.sports.createPlayer, {
      name: "Solo",
      teamId,
      position: "QB",
      jerseyNumber: 9,
      dateOfBirth: null,
      status: "Active",
    });
    // Re-saving the same number for the same player must not self-conflict.
    const updated = await t.mutation(internal.sports.updatePlayer, {
      playerId: player.id as Id<"players">,
      jerseyNumber: 9,
      position: "WR",
    });
    expect(updated?.jerseyNumber).toBe(9);
    expect(updated?.position).toBe("WR");
  });

  it("ignores non-active players when blocking duplicates", async () => {
    const t = convexTest(schema, modules);
    const teamId = await seedTeam(t, false);
    // An inactive player wearing #4 should not block a new active #4.
    await t.mutation(internal.sports.createPlayer, {
      name: "Benched",
      teamId,
      position: "QB",
      jerseyNumber: 4,
      dateOfBirth: null,
      status: "Inactive",
    });
    const active = await t.mutation(internal.sports.createPlayer, {
      name: "Starter",
      teamId,
      position: "QB",
      jerseyNumber: 4,
      dateOfBirth: null,
      status: "Active",
    });
    expect(active.jerseyNumber).toBe(4);
  });
});

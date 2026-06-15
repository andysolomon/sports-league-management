/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

async function seedLeague(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "L",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", {
      name: "East",
      leagueId,
    });
    return { leagueId, divisionId };
  });
}

async function addTeam(
  t: ReturnType<typeof convexTest>,
  leagueId: Id<"leagues">,
  divisionId: Id<"divisions">,
) {
  return t.run((ctx) =>
    ctx.db.insert("teams", {
      name: "Team",
      leagueId,
      divisionId,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "Loc",
      logoUrl: null,
      rosterLimit: 53,
    }),
  );
}

describe("division CRUD (WSM-000132 / WSM-000128)", () => {
  it("updateDivision renames", async () => {
    const t = convexTest(schema, modules);
    const { divisionId } = await seedLeague(t);
    const dto = await t.mutation(internal.sports.updateDivision, {
      divisionId,
      name: "West",
    });
    expect(dto?.name).toBe("West");
  });

  it("deleteDivision refuses a non-empty division", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, divisionId } = await seedLeague(t);
    await addTeam(t, leagueId, divisionId);

    const res = await t.mutation(internal.sports.deleteDivision, {
      divisionId,
    });
    expect(res.ok).toBe(false);
    expect(res.teamCount).toBe(1);

    const stillThere = await t.run((ctx) => ctx.db.get(divisionId));
    expect(stillThere).not.toBeNull();
  });

  it("deleteDivision removes an empty division", async () => {
    const t = convexTest(schema, modules);
    const { divisionId } = await seedLeague(t);
    const res = await t.mutation(internal.sports.deleteDivision, {
      divisionId,
    });
    expect(res.ok).toBe(true);
    const gone = await t.run((ctx) => ctx.db.get(divisionId));
    expect(gone).toBeNull();
  });
});

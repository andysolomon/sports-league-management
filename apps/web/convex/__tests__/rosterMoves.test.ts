/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "user_admin";

/*
 * Roster shaping (B5). One team, a handful of players across grades and
 * squads, so each rule has a case it can actually be broken by.
 */
async function seedTeam(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Roster League",
      orgId: "org_test",
      isPublic: false,
      inviteToken: null,
    });
    const seasonId = await ctx.db.insert("seasons", {
      leagueId,
      name: "2027",
      status: "upcoming",
      startDate: null,
      endDate: null,
      rosterLocked: false,
    });
    const teamIds: string[] = [];
    for (const name of ["North", "South"]) {
      teamIds.push(
        (await ctx.db.insert("teams", {
          leagueId,
          name: `${name} HS`,
          city: name,
          stadium: `${name} Field`,
          location: `${name}, GA`,
          foundedYear: null,
          divisionId: null,
          rosterLimit: null,
          logoUrl: null,
        })) as string,
      );
    }

    async function addPlayer(spec: {
      name: string;
      position: string;
      grade: number | null;
      squad: string;
      overall: number;
      teamIndex?: number;
      depthRank?: number;
      withDepthEntry?: boolean;
    }) {
      const teamId = teamIds[spec.teamIndex ?? 0] as never;
      const playerId = await ctx.db.insert("players", {
        name: spec.name,
        leagueId,
        teamId,
        position: spec.position,
        positionGroup: null,
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
        experienceYears: null,
        grade: spec.grade,
        squad: spec.squad,
        hometown: null,
        synthetic: true,
      });
      await ctx.db.insert("rosterAssignments", {
        seasonId,
        teamId,
        playerId,
        leagueId,
        depthRank: spec.depthRank ?? 1,
        positionSlot: spec.position,
        status: "active",
        assignedAt: new Date(0).toISOString(),
        assignedBy: ACTOR,
      });
      if (spec.withDepthEntry !== false) {
        await ctx.db.insert("depthChartEntries", {
          teamId,
          seasonId,
          playerId,
          positionSlot: spec.position,
          sortOrder: (spec.depthRank ?? 1) - 1,
          updatedAt: new Date(0).toISOString(),
        });
      }
      await ctx.db.insert("playerAttributes", {
        playerId,
        seasonId,
        positionGroup: "WR",
        attributesJson: JSON.stringify({ SPD: spec.overall, STR: 60 }),
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 0,
        weightedOverall: spec.overall,
        ingestedAt: new Date(0).toISOString(),
      });
      return playerId;
    }

    const sophomore = await addPlayer({
      name: "Cam Whitfield",
      position: "WR",
      grade: 10,
      squad: "JV",
      overall: 84,
      depthRank: 2,
    });
    const senior = await addPlayer({
      name: "Ty Barrow",
      position: "WR",
      grade: 12,
      squad: "Varsity",
      overall: 70,
    });
    const freshman = await addPlayer({
      name: "Nate Ellis",
      position: "CB",
      grade: 9,
      squad: "JV",
      overall: 88,
    });
    const gradeless = await addPlayer({
      name: "Unknown Grade",
      position: "TE",
      grade: null,
      squad: "JV",
      overall: 75,
    });
    const rival = await addPlayer({
      name: "Other Program",
      position: "QB",
      grade: 11,
      squad: "Varsity",
      overall: 80,
      teamIndex: 1,
    });

    return {
      leagueId,
      seasonId,
      teamIds,
      sophomore,
      senior,
      freshman,
      gradeless,
      rival,
    };
  });
}

describe("listRosterBoard", () => {
  it("returns this team's roster with everything a decision needs", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    const rows = await t.query(api.dynasty.listRosterBoard, {
      seasonId: seed.seasonId,
      teamId: seed.teamIds[0] as never,
    });

    expect(rows).toHaveLength(4);
    const cam = rows.find((row) => row.name === "Cam Whitfield");
    expect(cam).toMatchObject({ grade: 10, squad: "JV", overall: 84 });
    // Attributes travel with the row so the panel can price a position change
    // without a round trip per candidate.
    expect(JSON.parse(cam?.attributesJson ?? "{}")).toMatchObject({ SPD: 84 });
  });

  it("does not leak another program's roster", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    const rows = await t.query(api.dynasty.listRosterBoard, {
      seasonId: seed.seasonId,
      teamId: seed.teamIds[0] as never,
    });
    expect(rows.some((row) => row.name === "Other Program")).toBe(false);
  });
});

describe("setPlayerSquad", () => {
  it("promotes a sophomore and records it", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    const result = await t.mutation(internal.dynasty.setPlayerSquad, {
      playerId: seed.sophomore,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      squad: "Varsity",
      actorUserId: ACTOR,
    });
    expect(result).toEqual({ squad: "Varsity", changed: true });

    await t.run(async (ctx) => {
      expect((await ctx.db.get(seed.sophomore))?.squad).toBe("Varsity");
      const audit = await ctx.db.query("rosterAuditLog").collect();
      expect(audit.map((row) => row.action)).toContain("promote");
    });
  });

  it("refuses a freshman", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await expect(
      t.mutation(internal.dynasty.setPlayerSquad, {
        playerId: seed.freshman,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        squad: "Varsity",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow("grade_too_low_for_varsity");
  });

  it("refuses to send a senior down to JV", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await expect(
      t.mutation(internal.dynasty.setPlayerSquad, {
        playerId: seed.senior,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        squad: "JV",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow("grade_requires_varsity");
  });

  it("refuses a player with no grade rather than assuming one", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await expect(
      t.mutation(internal.dynasty.setPlayerSquad, {
        playerId: seed.gradeless,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        squad: "Varsity",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow("grade_unknown");
  });

  it("refuses a coach acting for a team the player is not on", async () => {
    /*
     * The DB half of the per-team gate. The Next layer authorizes a `teamId`;
     * if this mutation derived the team from the player instead, an action
     * that authorized team A could patch a player who had since moved to B.
     */
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await expect(
      t.mutation(internal.dynasty.setPlayerSquad, {
        playerId: seed.sophomore,
        teamId: seed.teamIds[1] as never,
        seasonId: seed.seasonId,
        squad: "Varsity",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow("player_not_on_team");
  });

  it("treats a repeat of the same move as a no-op", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    const args = {
      playerId: seed.sophomore,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      squad: "Varsity",
      actorUserId: ACTOR,
    };
    await t.mutation(internal.dynasty.setPlayerSquad, args);
    const second = await t.mutation(internal.dynasty.setPlayerSquad, args);
    expect(second).toEqual({ squad: "Varsity", changed: false });

    // And it does not write a second audit row for a decision made once.
    await t.run(async (ctx) => {
      const audit = await ctx.db.query("rosterAuditLog").collect();
      expect(audit.filter((row) => row.action === "promote")).toHaveLength(1);
    });
  });
});

describe("changePlayerPosition", () => {
  it("rewrites the player, the assignment and the depth chart together", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    const result = await t.mutation(internal.dynasty.changePlayerPosition, {
      playerId: seed.sophomore,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      position: "CB",
      actorUserId: ACTOR,
    });
    expect(result).toMatchObject({
      position: "CB",
      positionGroup: "DB",
      changed: true,
    });

    await t.run(async (ctx) => {
      const player = await ctx.db.get(seed.sophomore);
      expect(player?.position).toBe("CB");
      expect(player?.positionGroup).toBe("DB");

      // No stale slot anywhere: this is the bug the AC names.
      const assignments = (
        await ctx.db.query("rosterAssignments").collect()
      ).filter((row) => row.playerId === seed.sophomore);
      expect(assignments.map((row) => row.positionSlot)).toEqual(["CB"]);

      const depth = (await ctx.db.query("depthChartEntries").collect()).filter(
        (row) => row.playerId === seed.sophomore,
      );
      expect(depth.map((row) => row.positionSlot)).toEqual(["CB"]);
    });
  });

  it("puts him at the BACK of his new position's depth", async () => {
    /*
     * He was WR2. Converting him must not hand him the CB job over the player
     * who already holds it — he has never played there.
     */
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await t.mutation(internal.dynasty.changePlayerPosition, {
      playerId: seed.sophomore,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      position: "CB",
      actorUserId: ACTOR,
    });

    await t.run(async (ctx) => {
      const cbs = (await ctx.db.query("rosterAssignments").collect()).filter(
        (row) => row.positionSlot === "CB",
      );
      const moved = cbs.find((row) => row.playerId === seed.sophomore);
      const incumbent = cbs.find((row) => row.playerId === seed.freshman);
      expect(moved?.depthRank).toBeGreaterThan(incumbent?.depthRank ?? 0);
    });
  });

  it("rejects a position the league does not recognise", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await expect(
      t.mutation(internal.dynasty.changePlayerPosition, {
        playerId: seed.sophomore,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        position: "GOALIE",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow("invalid_position");
  });

  it("refuses to reshape a locked roster", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(seed.seasonId, { rosterLocked: true });
    });
    await expect(
      t.mutation(internal.dynasty.changePlayerPosition, {
        playerId: seed.sophomore,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        position: "CB",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow("season_locked");
  });

  it("is a no-op when he already plays there", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    const result = await t.mutation(internal.dynasty.changePlayerPosition, {
      playerId: seed.sophomore,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      position: "WR",
      actorUserId: ACTOR,
    });
    expect(result.changed).toBe(false);
  });

  it("refuses a coach acting for another program's player", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await expect(
      t.mutation(internal.dynasty.changePlayerPosition, {
        playerId: seed.rival,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        position: "WR",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow("player_not_on_team");
  });
});

describe("cuts route through the existing release", () => {
  it("clears the roster rows and drops him to free agency", async () => {
    /*
     * B5 adds no release path of its own. This asserts the existing one still
     * does what a cut needs, so the panel wiring is the only new part.
     */
    const t = convexTest(schema, modules);
    const seed = await seedTeam(t);
    await t.mutation(internal.sports.releasePlayerToFreeAgency, {
      playerId: seed.sophomore,
    });

    await t.run(async (ctx) => {
      expect((await ctx.db.get(seed.sophomore))?.status).toBe("free_agent");
      const assignments = (
        await ctx.db.query("rosterAssignments").collect()
      ).filter((row) => row.playerId === seed.sophomore);
      expect(assignments).toEqual([]);
    });

    const rows = await t.query(api.dynasty.listRosterBoard, {
      seasonId: seed.seasonId,
      teamId: seed.teamIds[0] as never,
    });
    expect(rows.some((row) => row.name === "Cam Whitfield")).toBe(false);
  });
});

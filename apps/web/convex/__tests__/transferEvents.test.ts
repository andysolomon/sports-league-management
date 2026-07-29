/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { MAX_TARGET_ROSTER_SIZE } from "../lib/offseason";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "user_admin";

/*
 * A league built to guarantee a slate: four teams, and one team stacked deep
 * with high-rated juniors so the seeded roll finds somebody. Relying on a
 * realistic roster would make these tests depend on the RNG landing well.
 */
async function seedLeague(
  t: ReturnType<typeof convexTest>,
  opts: { depth?: number; overall?: number } = {},
) {
  const depth = opts.depth ?? 6;
  const overall = opts.overall ?? 95;
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Transfer League",
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
    const teamIds = [];
    for (const name of ["North", "South", "East", "West"]) {
      teamIds.push(
        await ctx.db.insert("teams", {
          leagueId,
          name: `${name} HS`,
          city: name,
          stadium: `${name} Field`,
          location: `${name}, GA`,
          foundedYear: null,
          divisionId: null,
          rosterLimit: null,
          logoUrl: null,
        }),
      );
    }

    // Stack the first team: one starter and `depth - 1` buried juniors.
    const playerIds = [];
    for (let i = 0; i < depth; i++) {
      const playerId = await ctx.db.insert("players", {
        name: `Buried ${i}`,
        leagueId,
        teamId: teamIds[0],
        position: "WR",
        positionGroup: null,
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
        experienceYears: null,
        grade: 11,
        squad: "Varsity",
        hometown: null,
        synthetic: true,
      });
      await ctx.db.insert("rosterAssignments", {
        seasonId,
        teamId: teamIds[0],
        playerId,
        leagueId,
        depthRank: i + 1,
        positionSlot: "WR",
        status: "active",
        assignedAt: new Date(0).toISOString(),
        assignedBy: ACTOR,
      });
      await ctx.db.insert("playerAttributes", {
        playerId,
        seasonId,
        positionGroup: "WR",
        attributesJson: JSON.stringify({ SPD: overall }),
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 0,
        weightedOverall: overall,
        ingestedAt: new Date(0).toISOString(),
      });
      playerIds.push(playerId);
    }
    return { leagueId, seasonId, teamIds, playerIds };
  });
}

async function openWindow(
  t: ReturnType<typeof convexTest>,
  seasonId: never,
) {
  return t.mutation(internal.dynasty.generateTransferWindow, {
    seasonId,
    actorUserId: ACTOR,
  });
}

describe("generateTransferWindow", () => {
  it("puts buried players in the window with offers from other programs", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    const result = await openWindow(t, ids.seasonId as never);
    expect(result.outbound).toBeGreaterThan(0);
    expect(result.offers).toBeGreaterThan(0);

    const rows = await t.query(api.dynasty.listTransfers, {
      seasonId: ids.seasonId,
    });
    const out = rows.filter((r) => r.direction === "out");
    const inn = rows.filter((r) => r.direction === "in");
    expect(out.length).toBe(result.outbound);
    expect(inn.length).toBe(result.offers);
    // Conserved: every offer traces back to a real outbound player.
    const outPlayers = new Set(out.map((r) => r.playerId));
    expect(inn.every((r) => outPlayers.has(r.playerId))).toBe(true);
    expect(inn.every((r) => r.toTeamId !== r.fromTeamId)).toBe(true);
  });

  it("does not open a second window on a retry", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    const first = await openWindow(t, ids.seasonId as never);
    const retry = await openWindow(t, ids.seasonId as never);
    expect(retry.alreadyExisted).toBe(true);
    expect(retry.outbound).toBe(first.outbound);
    const rows = await t.query(api.dynasty.listTransfers, {
      seasonId: ids.seasonId,
    });
    expect(rows.filter((r) => r.direction === "out")).toHaveLength(
      first.outbound,
    );
  });

  it("generates nothing when transfers are switched off", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    await t.mutation(internal.dynasty.setDynastyConfig, {
      leagueId: ids.leagueId,
      actorUserId: ACTOR,
      patch: { transfersEnabled: false },
    });
    const result = await openWindow(t, ids.seasonId as never);
    expect(result).toEqual({
      outbound: 0,
      offers: 0,
      alreadyExisted: false,
    });
    expect(
      await t.query(api.dynasty.listTransfers, { seasonId: ids.seasonId }),
    ).toEqual([]);
  });

  it("leaves graduated players out of the window", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    await t.run(async (ctx) => {
      for (const playerId of ids.playerIds) {
        await ctx.db.patch(playerId, { status: "graduated" });
      }
    });
    const result = await openWindow(t, ids.seasonId as never);
    expect(result.outbound).toBe(0);
  });
});

describe("resolveTransfer — the losing coach", () => {
  async function windowed() {
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    await openWindow(t, ids.seasonId as never);
    const rows = await t.query(api.dynasty.listTransfers, {
      seasonId: ids.seasonId,
    });
    return { t, ids, rows };
  }

  it("retains a player and withdraws every offer for him", async () => {
    const { t, ids, rows } = await windowed();
    const out = rows.find((r) => r.direction === "out")!;
    const result = await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: out.id as never,
      teamId: ids.teamIds[0],
      decision: "reject",
      actorUserId: ACTOR,
    });
    expect(result.status).toBe("rejected");
    expect(result.withdrawn).toBeGreaterThan(0);

    const after = await t.query(api.dynasty.listTransfers, {
      seasonId: ids.seasonId,
    });
    const hisOffers = after.filter(
      (r) => r.direction === "in" && r.playerId === out.playerId,
    );
    expect(hisOffers.every((r) => r.status === "withdrawn")).toBe(true);
  });

  it("releasing him changes nothing on any roster yet", async () => {
    /*
     * A release puts him on the market; it does not move him. Emitting an
     * event or touching a roster here would announce a transfer that may never
     * happen.
     */
    const { t, ids, rows } = await windowed();
    const out = rows.find((r) => r.direction === "out")!;
    const result = await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: out.id as never,
      teamId: ids.teamIds[0],
      decision: "accept",
      actorUserId: ACTOR,
    });
    expect(result).toEqual({
      status: "accepted",
      moved: false,
      withdrawn: 0,
    });
    await t.run(async (ctx) => {
      const player = await ctx.db.get(out.playerId as never);
      expect((player as { teamId: unknown }).teamId).toBe(ids.teamIds[0]);
      const events = await ctx.db.query("dynastyEvents").collect();
      expect(events).toHaveLength(0);
    });
  });

  it("refuses a decision from a team that does not own it", async () => {
    // The per-team argument is the Wave 5 hook; this is what makes it real.
    const { t, ids, rows } = await windowed();
    const out = rows.find((r) => r.direction === "out")!;
    await expect(
      t.mutation(internal.dynasty.resolveTransfer, {
        transferId: out.id as never,
        teamId: ids.teamIds[1],
        decision: "reject",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/transfer_team_mismatch/);
  });

  it("refuses to resolve the same row twice", async () => {
    const { t, ids, rows } = await windowed();
    const out = rows.find((r) => r.direction === "out")!;
    await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: out.id as never,
      teamId: ids.teamIds[0],
      decision: "reject",
      actorUserId: ACTOR,
    });
    await expect(
      t.mutation(internal.dynasty.resolveTransfer, {
        transferId: out.id as never,
        teamId: ids.teamIds[0],
        decision: "accept",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/transfer_not_pending/);
  });
});

describe("resolveTransfer — a destination coach", () => {
  async function released() {
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    await openWindow(t, ids.seasonId as never);
    const rows = await t.query(api.dynasty.listTransfers, {
      seasonId: ids.seasonId,
    });
    const out = rows.find((r) => r.direction === "out")!;
    await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: out.id as never,
      teamId: ids.teamIds[0],
      decision: "accept",
      actorUserId: ACTOR,
    });
    const offers = (
      await t.query(api.dynasty.listTransfers, { seasonId: ids.seasonId })
    ).filter((r) => r.direction === "in" && r.playerId === out.playerId);
    return { t, ids, out, offers };
  }

  it("cannot sign a player his own coach has not released", async () => {
    /*
     * Two people, two decisions, and they can race. The check lives in the
     * mutation rather than the UI because a destination coach's page may have
     * rendered before the losing coach decided anything.
     */
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    await openWindow(t, ids.seasonId as never);
    const offer = (
      await t.query(api.dynasty.listTransfers, { seasonId: ids.seasonId })
    ).find((r) => r.direction === "in")!;
    await expect(
      t.mutation(internal.dynasty.resolveTransfer, {
        transferId: offer.id as never,
        teamId: offer.toTeamId as never,
        decision: "accept",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/transfer_not_released/);
  });

  it("moves the player, his roster spot and his depth chart", async () => {
    const { t, ids, out, offers } = await released();
    const offer = offers[0];
    const result = await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: offer.id as never,
      teamId: offer.toTeamId as never,
      decision: "accept",
      actorUserId: ACTOR,
    });
    expect(result.moved).toBe(true);

    await t.run(async (ctx) => {
      const player = await ctx.db.get(out.playerId as never);
      expect((player as { teamId: unknown }).teamId).toBe(offer.toTeamId);

      const assignments = (
        await ctx.db
          .query("rosterAssignments")
          .withIndex("by_playerId", (q) =>
            q.eq("playerId", out.playerId as never),
          )
          .collect()
      ).filter((row) => row.seasonId === ids.seasonId);
      // Exactly one — the old spot is deleted, not left behind. A stale row
      // would make him show up on two rosters at once.
      expect(assignments).toHaveLength(1);
      expect(assignments[0].teamId).toBe(offer.toTeamId);
    });
  });

  it("withdraws the rival offers when one destination signs him", async () => {
    const { t, ids, out, offers } = await released();
    expect(offers.length).toBeGreaterThan(1);
    await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: offers[0].id as never,
      teamId: offers[0].toTeamId as never,
      decision: "accept",
      actorUserId: ACTOR,
    });
    const after = (
      await t.query(api.dynasty.listTransfers, { seasonId: ids.seasonId })
    ).filter((r) => r.direction === "in" && r.playerId === out.playerId);
    expect(after.filter((r) => r.status === "accepted")).toHaveLength(1);
    expect(after.filter((r) => r.status === "withdrawn")).toHaveLength(
      offers.length - 1,
    );
  });

  it("refuses to overfill a roster", async () => {
    /*
     * Re-checked at acceptance, not only when the offer was made. Recruiting,
     * the draft or another transfer may have filled the destination since.
     */
    const { t, ids, offers } = await released();
    const offer = offers[0];
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_TARGET_ROSTER_SIZE; i++) {
        const playerId = await ctx.db.insert("players", {
          name: `Filler ${i}`,
          leagueId: ids.leagueId,
          teamId: offer.toTeamId as never,
          position: "OL",
          positionGroup: null,
          jerseyNumber: null,
          dateOfBirth: null,
          status: "active",
          headshotUrl: null,
          experienceYears: null,
          grade: 10,
          squad: "Varsity",
          hometown: null,
          synthetic: true,
        });
        await ctx.db.insert("rosterAssignments", {
          seasonId: ids.seasonId,
          teamId: offer.toTeamId as never,
          playerId,
          leagueId: ids.leagueId,
          depthRank: i + 1,
          positionSlot: "OL",
          status: "active",
          assignedAt: new Date(0).toISOString(),
          assignedBy: ACTOR,
        });
      }
    });
    await expect(
      t.mutation(internal.dynasty.resolveTransfer, {
        transferId: offer.id as never,
        teamId: offer.toTeamId as never,
        decision: "accept",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/roster_full/);
  });

  it("refuses to move a player into a locked season", async () => {
    const { t, ids, offers } = await released();
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.seasonId, { rosterLocked: true } as never);
    });
    await expect(
      t.mutation(internal.dynasty.resolveTransfer, {
        transferId: offers[0].id as never,
        teamId: offers[0].toTeamId as never,
        decision: "accept",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/season_locked/);
  });

  it("passing on an offer leaves the others alone", async () => {
    const { t, ids, out, offers } = await released();
    await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: offers[0].id as never,
      teamId: offers[0].toTeamId as never,
      decision: "reject",
      actorUserId: ACTOR,
    });
    const after = (
      await t.query(api.dynasty.listTransfers, { seasonId: ids.seasonId })
    ).filter((r) => r.direction === "in" && r.playerId === out.playerId);
    expect(after.find((r) => r.id === offers[0].id)?.status).toBe("rejected");
    expect(after.filter((r) => r.status === "pending")).toHaveLength(
      offers.length - 1,
    );
  });
});

describe("transfer events", () => {
  it("writes exactly one event per resolved transfer", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    await openWindow(t, ids.seasonId as never);
    const rows = await t.query(api.dynasty.listTransfers, {
      seasonId: ids.seasonId,
    });
    const out = rows.find((r) => r.direction === "out")!;

    await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: out.id as never,
      teamId: ids.teamIds[0],
      decision: "accept",
      actorUserId: ACTOR,
    });
    const offer = (
      await t.query(api.dynasty.listTransfers, { seasonId: ids.seasonId })
    ).find((r) => r.direction === "in" && r.playerId === out.playerId)!;
    await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: offer.id as never,
      teamId: offer.toTeamId as never,
      decision: "accept",
      actorUserId: ACTOR,
    });

    await t.run(async (ctx) => {
      const events = await ctx.db.query("dynastyEvents").collect();
      // ONE. The release is not news; the move is.
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("transfer_completed");
      expect(events[0].category).toBe("offseason");
      expect(events[0].headline).toContain("transfers from");
    });
  });

  it("writes one event for a retention too", async () => {
    // A program talking a player out of leaving is exactly what a dynasty
    // should remember.
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    await openWindow(t, ids.seasonId as never);
    const out = (
      await t.query(api.dynasty.listTransfers, { seasonId: ids.seasonId })
    ).find((r) => r.direction === "out")!;
    await t.mutation(internal.dynasty.resolveTransfer, {
      transferId: out.id as never,
      teamId: ids.teamIds[0],
      decision: "reject",
      actorUserId: ACTOR,
    });
    await t.run(async (ctx) => {
      const events = await ctx.db.query("dynastyEvents").collect();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("transfer_retained");
      expect(events[0].dedupeKey).toBe(`transfer_resolved:${out.id}`);
    });
  });

  it("keys the event on the transfer row, so two players do not collide", async () => {
    /*
     * Keying on player and season would make a second decision about the same
     * player overwrite the first — and the release-then-sign sequence is
     * exactly two decisions about one player.
     */
    const t = convexTest(schema, modules);
    const ids = await seedLeague(t);
    await openWindow(t, ids.seasonId as never);
    const outs = (
      await t.query(api.dynasty.listTransfers, { seasonId: ids.seasonId })
    ).filter((r) => r.direction === "out");
    expect(outs.length).toBeGreaterThan(1);
    for (const out of outs) {
      await t.mutation(internal.dynasty.resolveTransfer, {
        transferId: out.id as never,
        teamId: ids.teamIds[0],
        decision: "reject",
        actorUserId: ACTOR,
      });
    }
    await t.run(async (ctx) => {
      const events = await ctx.db.query("dynastyEvents").collect();
      expect(events).toHaveLength(outs.length);
      expect(new Set(events.map((e) => e.dedupeKey)).size).toBe(outs.length);
    });
  });
});

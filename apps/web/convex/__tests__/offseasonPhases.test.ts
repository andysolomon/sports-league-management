/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { OFFSEASON_PHASES, phaseGate } from "../lib/offseasonPhases";
import {
  OFFSEASON_PHASES as NEXT_PHASES,
  phaseGate as nextPhaseGate,
} from "../../src/lib/dynasty/offseason-phases";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "user_admin";

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Offseason League",
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
    return { leagueId, seasonId };
  });
}

describe("offseason phase machine — one definition, two import paths", () => {
  it("gives the Convex side and the Next side the same rules", () => {
    // `src/lib/dynasty/offseason-phases.ts` re-exports rather than mirroring.
    // If someone forks it into a copy, the button the UI enables and the
    // advance the mutation permits could silently disagree.
    expect(NEXT_PHASES).toEqual(OFFSEASON_PHASES);
    expect(
      nextPhaseGate({ from: "draft", to: "free_agency", draftStatus: "active" }),
    ).toEqual(
      phaseGate({ from: "draft", to: "free_agency", draftStatus: "active" }),
    );
  });
});

describe("beginOffseason", () => {
  it("opens at draft with the rollover already recorded", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seed(t);
    const opened = await t.mutation(internal.dynasty.beginOffseason, {
      seasonId,
      actorUserId: ACTOR,
    });
    expect(opened.phase).toBe("draft");
    expect(opened.completedPhases).toEqual(["rollover"]);
  });

  it("is idempotent — a second call returns the same row", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seed(t);
    const first = await t.mutation(internal.dynasty.beginOffseason, {
      seasonId,
      actorUserId: ACTOR,
    });
    const second = await t.mutation(internal.dynasty.beginOffseason, {
      seasonId,
      actorUserId: ACTOR,
    });
    expect(second.id).toBe(first.id);
  });

  it("snapshots the league's point budgets at open", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId } = await seed(t);
    await t.mutation(internal.dynasty.setDynastyConfig, {
      leagueId,
      actorUserId: ACTOR,
      patch: { scoutingPointsPerOffseason: 40 },
    });
    const opened = await t.mutation(internal.dynasty.beginOffseason, {
      seasonId,
      actorUserId: ACTOR,
    });
    expect(opened.scoutingPointsTotal).toBe(40);

    // Raising the knob afterwards must not retroactively change a budget that
    // an offseason may already have spent against.
    await t.mutation(internal.dynasty.setDynastyConfig, {
      leagueId,
      actorUserId: ACTOR,
      patch: { scoutingPointsPerOffseason: 99 },
    });
    const reread = await t.query(api.dynasty.getOffseason, { seasonId });
    expect(reread?.scoutingPointsTotal).toBe(40);
  });

  it("refuses to open on a season that has already started", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(seasonId, { status: "active" } as never);
    });
    await expect(
      t.mutation(internal.dynasty.beginOffseason, {
        seasonId,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/season_not_upcoming/);
  });
});

describe("getOffseason", () => {
  it("returns null for a season that never opened one", async () => {
    // Honest absence: defaulting here would hide which leagues still need a
    // row, and the stepper's bridge is where absence becomes renderable.
    const t = convexTest(schema, modules);
    const { seasonId } = await seed(t);
    expect(await t.query(api.dynasty.getOffseason, { seasonId })).toBeNull();
  });
});

describe("advanceOffseasonPhase", () => {
  async function opened() {
    const t = convexTest(schema, modules);
    const { seasonId } = await seed(t);
    await t.mutation(internal.dynasty.beginOffseason, {
      seasonId,
      actorUserId: ACTOR,
    });
    return { t, seasonId };
  }

  const advance = (
    t: ReturnType<typeof convexTest>,
    seasonId: never,
    args: Partial<{
      expectedPhase: string;
      to: string;
      ownerId: string;
      draftStatus: string;
    }> = {},
  ) =>
    t.mutation(internal.dynasty.advanceOffseasonPhase, {
      seasonId,
      expectedPhase: args.expectedPhase ?? "draft",
      to: args.to ?? "free_agency",
      ownerId: args.ownerId ?? "owner_a",
      actorUserId: ACTOR,
      draftStatus: args.draftStatus ?? "none",
    });

  it("moves forward and records the phase it left", async () => {
    const { t, seasonId } = await opened();
    const result = await advance(t, seasonId as never);
    expect(result.changed).toBe(true);
    expect(result.offseason.phase).toBe("free_agency");
    expect(result.offseason.completedPhases).toEqual(["rollover", "draft"]);
  });

  it("advancing twice with the same payload produces one state change", async () => {
    const { t, seasonId } = await opened();
    const first = await advance(t, seasonId as never);
    const second = await advance(t, seasonId as never);
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(second.offseason.completedPhases).toEqual(
      first.offseason.completedPhases,
    );
    expect(second.offseason.phase).toBe("free_agency");
  });

  it("rejects a backward request as phase_regression", async () => {
    const { t, seasonId } = await opened();
    await advance(t, seasonId as never);
    await expect(
      advance(t, seasonId as never, {
        expectedPhase: "free_agency",
        to: "draft",
      }),
    ).rejects.toThrow(/phase_regression/);
  });

  it("resolves two concurrent advances to one winner and one phase_busy", async () => {
    const { t, seasonId } = await opened();
    /*
     * Both callers read phase `draft` and both send `expectedPhase: "draft"`.
     * Convex serializes them, so the loser finds its expectation stale — it
     * asked to move an offseason that someone else already moved.
     */
    const results = await Promise.allSettled([
      advance(t, seasonId as never, { ownerId: "owner_a" }),
      advance(t, seasonId as never, { ownerId: "owner_b" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(
      /phase_busy/,
    );

    const final = await t.query(api.dynasty.getOffseason, { seasonId });
    expect(final?.phase).toBe("free_agency");
    expect(final?.completedPhases).toEqual(["rollover", "draft"]);
  });

  it("refuses to leave the draft phase while a draft is mid-pick", async () => {
    const { t, seasonId } = await opened();
    await expect(
      advance(t, seasonId as never, { draftStatus: "active" }),
    ).rejects.toThrow(/draft_in_progress/);
  });

  it("reports an invalid request as invalid rather than as a conflict", async () => {
    // A skipped phase sent with a stale expectation is still out-of-order.
    // Masking it as phase_busy would send an admin looking for a second admin
    // who does not exist.
    const { t, seasonId } = await opened();
    await expect(
      advance(t, seasonId as never, {
        expectedPhase: "activate",
        to: "activate",
      }),
    ).rejects.toThrow(/phase_out_of_order/);
  });

  it("walks the whole machine to the end", async () => {
    const { t, seasonId } = await opened();
    for (let i = 1; i < OFFSEASON_PHASES.length - 1; i++) {
      await advance(t, seasonId as never, {
        expectedPhase: OFFSEASON_PHASES[i],
        to: OFFSEASON_PHASES[i + 1],
      });
    }
    const final = await t.query(api.dynasty.getOffseason, { seasonId });
    expect(final?.phase).toBe("activate");
    expect(final?.completedPhases).toEqual([
      "rollover",
      "draft",
      "free_agency",
    ]);
  });
});

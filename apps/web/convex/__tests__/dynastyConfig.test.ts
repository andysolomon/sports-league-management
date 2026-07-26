/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import {
  DYNASTY_CONFIG_BOUNDS,
  DYNASTY_CONFIG_DEFAULTS,
  normalizeDynastyConfigPatch,
  resolveDynastyConfig,
} from "../lib/dynastyConfig";
import {
  DYNASTY_CONFIG_DEFAULTS as NEXT_DEFAULTS,
  resolveDynastyConfig as nextResolve,
} from "../../src/lib/dynasty-config";

const modules = import.meta.glob("../**/*.*s");

describe("dynasty config — one definition, two import paths", () => {
  it("gives the Convex side and the Next side identical defaults", () => {
    // `src/lib/dynasty-config.ts` re-exports rather than mirroring, so these
    // are the same object. The assertion exists to FAIL LOUDLY if someone
    // later forks it into a copy — at which point the simulation and the
    // settings UI could silently disagree about what "normal" means.
    expect(NEXT_DEFAULTS).toEqual(DYNASTY_CONFIG_DEFAULTS);
    expect(nextResolve(null)).toEqual(resolveDynastyConfig(null));
  });
});

describe("resolveDynastyConfig", () => {
  it("treats absence as fully configured", () => {
    expect(resolveDynastyConfig(null)).toEqual(DYNASTY_CONFIG_DEFAULTS);
    expect(resolveDynastyConfig(undefined)).toEqual(DYNASTY_CONFIG_DEFAULTS);
    expect(resolveDynastyConfig({})).toEqual(DYNASTY_CONFIG_DEFAULTS);
  });

  it("fills only the missing knobs on a partial row", () => {
    const resolved = resolveDynastyConfig({ injuriesEnabled: false });
    expect(resolved.injuriesEnabled).toBe(false);
    expect(resolved.penaltiesEnabled).toBe(
      DYNASTY_CONFIG_DEFAULTS.penaltiesEnabled,
    );
    expect(resolved.targetRosterSize).toBe(
      DYNASTY_CONFIG_DEFAULTS.targetRosterSize,
    );
  });

  it("clamps out-of-range numbers rather than propagating them", () => {
    // Settings must never be able to break a simulation.
    const high = resolveDynastyConfig({
      injurySeverityScale: 99,
      targetRosterSize: 5000,
    });
    expect(high.injurySeverityScale).toBe(
      DYNASTY_CONFIG_BOUNDS.injurySeverityScale.max,
    );
    expect(high.targetRosterSize).toBe(
      DYNASTY_CONFIG_BOUNDS.targetRosterSize.max,
    );

    const low = resolveDynastyConfig({ injurySeverityScale: -4 });
    expect(low.injurySeverityScale).toBe(
      DYNASTY_CONFIG_BOUNDS.injurySeverityScale.min,
    );
  });

  it("falls back to a default for a garbage value instead of throwing", () => {
    const resolved = resolveDynastyConfig({
      injuriesEnabled: "yes" as unknown as boolean,
      transferVolume: "cataclysmic",
      injurySeverityScale: Number.NaN,
    });
    expect(resolved.injuriesEnabled).toBe(
      DYNASTY_CONFIG_DEFAULTS.injuriesEnabled,
    );
    expect(resolved.transferVolume).toBe(
      DYNASTY_CONFIG_DEFAULTS.transferVolume,
    );
    expect(Number.isFinite(resolved.injurySeverityScale)).toBe(true);
  });

  it("accepts every documented transfer volume", () => {
    for (const volume of ["low", "normal", "high"] as const) {
      expect(resolveDynastyConfig({ transferVolume: volume }).transferVolume).toBe(
        volume,
      );
    }
  });
});

describe("normalizeDynastyConfigPatch", () => {
  it("keeps only keys the caller actually sent", () => {
    const patch = normalizeDynastyConfigPatch({ pollsEnabled: false });
    expect(Object.keys(patch)).toEqual(["pollsEnabled"]);
    expect(patch.pollsEnabled).toBe(false);
  });

  it("drops unknown keys so they can never reach storage", () => {
    const patch = normalizeDynastyConfigPatch({
      pollsEnabled: false,
      cheatMode: true,
    } as never);
    expect(Object.keys(patch)).toEqual(["pollsEnabled"]);
  });
});

async function seedLeague(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) =>
    ctx.db.insert("leagues", {
      name: "Config League",
      orgId: "org_test",
      isPublic: false,
      inviteToken: null,
    }),
  );
}

describe("dynastyConfig storage", () => {
  it("returns defaults for a league that has never been configured", async () => {
    const t = convexTest(schema, modules);
    const leagueId = await seedLeague(t);

    const config = await t.query(api.dynasty.getDynastyConfig, { leagueId });
    expect(config).toEqual(DYNASTY_CONFIG_DEFAULTS);

    // No row was created by reading — absence stays absence.
    const rows = await t.run(async (ctx) =>
      ctx.db.query("dynastyConfig").collect(),
    );
    expect(rows).toEqual([]);
  });

  it("persists a patch and leaves other knobs alone", async () => {
    const t = convexTest(schema, modules);
    const leagueId = await seedLeague(t);

    await t.mutation(internal.dynasty.setDynastyConfig, {
      leagueId,
      actorUserId: "user_admin",
      patch: { injuriesEnabled: false },
    });
    await t.mutation(internal.dynasty.setDynastyConfig, {
      leagueId,
      actorUserId: "user_admin",
      patch: { transferVolume: "high" },
    });

    const config = await t.query(api.dynasty.getDynastyConfig, { leagueId });
    expect(config.injuriesEnabled).toBe(false);
    expect(config.transferVolume).toBe("high");
    expect(config.penaltiesEnabled).toBe(true);
  });

  it("keeps exactly one row per league across repeated saves", async () => {
    const t = convexTest(schema, modules);
    const leagueId = await seedLeague(t);

    for (let i = 0; i < 4; i++) {
      await t.mutation(internal.dynasty.setDynastyConfig, {
        leagueId,
        actorUserId: "user_admin",
        patch: { targetRosterSize: 40 + i },
      });
    }

    const rows = await t.run(async (ctx) =>
      ctx.db.query("dynastyConfig").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.targetRosterSize).toBe(43);
  });

  it("clamps on the way in, so storage can never hold a bad value", async () => {
    const t = convexTest(schema, modules);
    const leagueId = await seedLeague(t);

    const returned = await t.mutation(internal.dynasty.setDynastyConfig, {
      leagueId,
      actorUserId: "user_admin",
      patch: { targetRosterSize: 9999 },
    });
    expect(returned.targetRosterSize).toBe(
      DYNASTY_CONFIG_BOUNDS.targetRosterSize.max,
    );

    const stored = await t.run(async (ctx) =>
      ctx.db.query("dynastyConfig").collect(),
    );
    expect(stored[0]!.targetRosterSize).toBe(
      DYNASTY_CONFIG_BOUNDS.targetRosterSize.max,
    );
  });

  it("rejects a save against a league that does not exist", async () => {
    const t = convexTest(schema, modules);
    const leagueId = await seedLeague(t);
    await t.run(async (ctx) => ctx.db.delete(leagueId));

    await expect(
      t.mutation(internal.dynasty.setDynastyConfig, {
        leagueId,
        actorUserId: "user_admin",
        patch: { pollsEnabled: false },
      }),
    ).rejects.toThrow(/league_not_found/);
  });
});

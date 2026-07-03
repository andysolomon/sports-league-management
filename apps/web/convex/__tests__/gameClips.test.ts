/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

// WSM-000201 (#303 track 3): highlight clips. Writes are internalMutation;
// the public read lists READY clips through a playback-only projection (the
// clip's Mux asset id must never transit a public query).

async function seedFixture(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Clip League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const makeTeam = (name: string) =>
      ctx.db.insert("teams", {
        name,
        leagueId,
        divisionId: null,
        city: "City",
        stadium: "Stadium",
        foundedYear: null,
        location: "Loc",
        logoUrl: null,
        rosterLimit: null,
      });
    const homeTeamId = await makeTeam("Home");
    const awayTeamId = await makeTeam("Away");
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const fixtureId = await ctx.db.insert("fixtures", {
      seasonId,
      homeTeamId,
      awayTeamId,
      scheduledAt: null,
      week: 1,
      venue: null,
      status: "final",
      createdAt: "2026-07-03T00:00:00.000Z",
      createdBy: "user_admin",
    });
    return fixtureId;
  });
}

function clipArgs(fixtureId: Id<"fixtures">, n = 1) {
  return {
    fixtureId,
    muxAssetId: `clip_asset_${n}`,
    playbackId: `pb_clip_${n}`,
    label: `Highlight ${n}`,
    startTime: 60 * n,
    endTime: 60 * n + 30,
    createdBy: "user_admin",
  };
}

// NB: no `.withIndex` in t.run reads — TS truncates the per-table index map
// for late-defined tables under convex-test's strict ctx (see the note in
// playoffBracket.test.ts); gameClips is affected. Runtime is unaffected.
async function allClips(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ctx.db.query("gameClips").collect());
}

describe("gameClips write path (internal)", () => {
  it("createGameClip persists a preparing clip", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);

    const { id } = await t.mutation(
      internal.sports.createGameClip,
      clipArgs(fixtureId),
    );
    expect(id).toBeTruthy();

    const rows = await allClips(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fixtureId,
      muxAssetId: "clip_asset_1",
      playbackId: "pb_clip_1",
      label: "Highlight 1",
      status: "preparing",
    });
  });

  it("createGameClip rejects an unknown fixture", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);
    // Delete the fixture so the id is dangling.
    await t.run(async (ctx) => ctx.db.delete(fixtureId));
    await expect(
      t.mutation(internal.sports.createGameClip, clipArgs(fixtureId)),
    ).rejects.toThrow("fixture_not_found");
  });

  it("updateGameClipStatus flips the clip ready (webhook path, keyed by asset id)", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);
    await t.mutation(internal.sports.createGameClip, {
      ...clipArgs(fixtureId),
      playbackId: null, // creation raced — the webhook attaches it
    });

    const flipped = await t.mutation(internal.sports.updateGameClipStatus, {
      muxAssetId: "clip_asset_1",
      status: "ready",
      playbackId: "pb_clip_1",
    });
    expect(flipped).toBe(true);

    const rows = await allClips(t);
    expect(rows[0]).toMatchObject({ status: "ready", playbackId: "pb_clip_1" });
  });

  it("updateGameClipStatus is a no-op for unknown asset ids (idempotent webhooks)", async () => {
    const t = convexTest(schema, modules);
    await seedFixture(t);
    const flipped = await t.mutation(internal.sports.updateGameClipStatus, {
      muxAssetId: "clip_asset_ghost",
      status: "ready",
    });
    expect(flipped).toBe(false);
  });

  it("deleteGameClip removes the row only when the fixture matches", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);
    const otherFixtureId = await seedFixture(t);
    const { id } = await t.mutation(
      internal.sports.createGameClip,
      clipArgs(fixtureId),
    );

    // Wrong fixture → refused, row survives.
    const cross = await t.mutation(internal.sports.deleteGameClip, {
      clipId: id as Id<"gameClips">,
      fixtureId: otherFixtureId,
    });
    expect(cross).toBe(false);
    expect(await allClips(t)).toHaveLength(1);

    // Right fixture → deleted.
    const ok = await t.mutation(internal.sports.deleteGameClip, {
      clipId: id as Id<"gameClips">,
      fixtureId,
    });
    expect(ok).toBe(true);
    expect(await allClips(t)).toHaveLength(0);
  });
});

describe("listClipsByFixture (public projection)", () => {
  it("returns READY clips only, projected to playback-only fields", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);

    await t.mutation(internal.sports.createGameClip, clipArgs(fixtureId, 1));
    await t.mutation(internal.sports.createGameClip, clipArgs(fixtureId, 2));
    await t.mutation(internal.sports.createGameClip, {
      ...clipArgs(fixtureId, 3),
      playbackId: null, // ready but somehow playback-less → still hidden
    });
    await t.mutation(internal.sports.updateGameClipStatus, {
      muxAssetId: "clip_asset_1",
      status: "ready",
    });
    await t.mutation(internal.sports.updateGameClipStatus, {
      muxAssetId: "clip_asset_3",
      status: "ready",
    });
    // clip 2 stays "preparing".

    const clips = await t.query(api.sports.listClipsByFixture, { fixtureId });
    expect(clips).toHaveLength(1);
    // PUBLIC PROJECTION: playback fields only — the Mux asset id must not leak.
    expect(clips[0]).toEqual({
      playbackId: "pb_clip_1",
      label: "Highlight 1",
      createdAt: expect.any(String),
    });
  });

  it("returns an empty list for a fixture with no clips", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);
    expect(
      await t.query(api.sports.listClipsByFixture, { fixtureId }),
    ).toEqual([]);
  });
});

describe("listClipsAdminByFixture (internal read)", () => {
  it("returns every clip with lifecycle status + asset id for the trusted server", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);
    await t.mutation(internal.sports.createGameClip, clipArgs(fixtureId, 1));
    await t.mutation(internal.sports.createGameClip, clipArgs(fixtureId, 2));
    await t.mutation(internal.sports.updateGameClipStatus, {
      muxAssetId: "clip_asset_2",
      status: "errored",
    });

    const clips = await t.query(internal.sports.listClipsAdminByFixture, {
      fixtureId,
    });
    expect(clips).toHaveLength(2);
    expect(clips.map((c) => c.status).sort()).toEqual([
      "errored",
      "preparing",
    ]);
    expect(clips[0].muxAssetId).toBeTruthy();
  });
});

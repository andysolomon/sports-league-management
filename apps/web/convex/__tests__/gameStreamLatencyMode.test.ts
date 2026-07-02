/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

// WSM-000200 (#303 track 2): createGameStream records which latency mode the
// Mux stream was created in, so the LL-HLS cost/quality tradeoff can be
// evaluated per pilot. Legacy/omitted = standard behavior, field absent.

async function seedFixture(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Stream League",
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
      status: "scheduled",
      createdAt: "2026-07-02T00:00:00.000Z",
      createdBy: "user_admin",
    });
    return fixtureId;
  });
}

// NB: no `.withIndex` here — TS truncates the per-table index map for
// late-defined tables under convex-test's strict ctx (see the note in
// playoffBracket.test.ts); gameStreams is affected. Runtime is unaffected.
async function getStream(
  t: ReturnType<typeof convexTest>,
  fixtureId: Id<"fixtures">,
) {
  return t.run(async (ctx) =>
    (await ctx.db.query("gameStreams").collect()).find(
      (s) => s.fixtureId === fixtureId,
    ),
  );
}

describe("createGameStream latencyMode", () => {
  it("persists the low-latency opt-in", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);

    await t.mutation(internal.sports.createGameStream, {
      fixtureId,
      muxLiveStreamId: "ls_1",
      muxPlaybackId: "pb_1",
      latencyMode: "low",
      startedBy: "user_admin",
      maxDurationMinutes: 180,
    });

    const row = await getStream(t, fixtureId);
    expect(row?.latencyMode).toBe("low");
  });

  it("leaves latencyMode unset when omitted (standard path unchanged)", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);

    await t.mutation(internal.sports.createGameStream, {
      fixtureId,
      muxLiveStreamId: "ls_1",
      muxPlaybackId: "pb_1",
      startedBy: "user_admin",
      maxDurationMinutes: 180,
    });

    const row = await getStream(t, fixtureId);
    expect(row?.latencyMode).toBeUndefined();
  });

  it("youtube streams are unaffected by the mux latency field", async () => {
    const t = convexTest(schema, modules);
    const fixtureId = await seedFixture(t);

    await t.mutation(internal.sports.createGameStream, {
      fixtureId,
      provider: "youtube",
      youtubeVideoId: "yt_video_1",
      startedBy: "user_admin",
      maxDurationMinutes: 180,
    });

    const row = await getStream(t, fixtureId);
    expect(row?.status).toBe("active");
    expect(row?.latencyMode).toBeUndefined();
  });
});

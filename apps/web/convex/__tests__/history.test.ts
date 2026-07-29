/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { finalizeSeasonHistoryForSeason } from "../lib/historyFinalize";

const modules = import.meta.glob("../**/*.*s");

async function seedHistorySeason(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "History League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const teamIds: Id<"teams">[] = [];
    for (const name of ["Alphas", "Betas"]) {
      teamIds.push(
        await ctx.db.insert("teams", {
          name,
          leagueId,
          divisionId: null,
          city: "City",
          stadium: "Stadium",
          foundedYear: null,
          location: "Location",
          logoUrl: null,
          rosterLimit: 53,
        }),
      );
    }
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const playerIds: Id<"players">[] = [];
    for (let index = 0; index < teamIds.length; index++) {
      const teamId = teamIds[index]!;
      const playerId = await ctx.db.insert("players", {
        name: `Player ${index + 1}`,
        leagueId,
        teamId,
        position: "QB",
        positionGroup: null,
        jerseyNumber: index + 1,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
      });
      playerIds.push(playerId);
      await ctx.db.insert("playerSeasonAggregates", {
        leagueId,
        seasonId,
        teamId,
        playerId,
        position: "QB",
        positionGroup: null,
        gamesPlayed: 10,
        totalsJson: JSON.stringify({
          passing: { yards: 2000 + index * 100, td: 20 + index },
          rushing: { yards: 200 + index * 10, long: 40 + index },
        }),
        updatedAt: new Date(0).toISOString(),
      });
      await ctx.db.insert("seasonTeamRecords", {
        leagueId,
        seasonId,
        teamId,
        divisionId: null,
        wins: 8 + index,
        losses: 2 - index,
        ties: 0,
        pointsFor: 300 + index * 20,
        pointsAgainst: 200,
        divisionWins: 4,
        divisionLosses: 1,
        divisionTies: 0,
        headToHeadJson: "{}",
        streak: 1,
        lastResults: ["W"],
        gamesCounted: 10,
        updatedAt: new Date(0).toISOString(),
      });
    }
    return { leagueId, seasonId, teamIds, playerIds };
  });
}

async function historySnapshot(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    careers: await ctx.db.query("playerCareerTotals").collect(),
    records: await ctx.db.query("programRecords").collect(),
  }));
}

describe("finalizeSeasonHistory", () => {
  it("is idempotent: a second run leaves career totals and records unchanged", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedHistorySeason(t);

    await t.mutation(internal.history.finalizeSeasonHistory, { seasonId });
    const first = await historySnapshot(t);
    await t.mutation(internal.history.finalizeSeasonHistory, { seasonId });
    const second = await historySnapshot(t);

    expect(second).toEqual(first);
    expect(first.careers).toHaveLength(2);
    expect(first.records.length).toBeGreaterThan(0);
  });

  it("is invoked by completeSeason without changing its null return shape", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedHistorySeason(t);

    const result = await t.mutation(internal.sports.completeSeason, {
      seasonId,
      force: true,
    });
    expect(result).toBeNull();
    const snapshot = await historySnapshot(t);
    expect(snapshot.careers).toHaveLength(2);
    expect(snapshot.records.length).toBeGreaterThan(0);
  });

  it("performs zero reads of playerGameStats or gamePlayLogs", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedHistorySeason(t);
    const reads = new Map<string, number>();

    await t.run(async (ctx) => {
      const originalQuery = ctx.db.query.bind(ctx.db);
      ctx.db.query = ((tableName: string) => {
        reads.set(tableName, (reads.get(tableName) ?? 0) + 1);
        return originalQuery(tableName as never);
      }) as unknown as typeof ctx.db.query;
      await finalizeSeasonHistoryForSeason(
        ctx as unknown as MutationCtx,
        seasonId,
      );
    });

    expect(reads.get("playerGameStats") ?? 0).toBe(0);
    expect(reads.get("gamePlayLogs") ?? 0).toBe(0);
    expect(reads.get("playerSeasonAggregates")).toBe(1);
    expect(reads.get("seasonTeamRecords")).toBe(1);
  });

  it("property: every career key equals the sum across random multi-season histories", async () => {
    const t = convexTest(schema, modules);
    let state = 0x630d1;
    const randomInt = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % max;
    };

    for (let history = 0; history < 12; history++) {
      const seeded = await t.run(async (ctx) => {
        const leagueId = await ctx.db.insert("leagues", {
          name: `Property League ${history}`,
          orgId: null,
          isPublic: true,
          inviteToken: null,
        });
        const teamId = await ctx.db.insert("teams", {
          name: `Team ${history}`,
          leagueId,
          divisionId: null,
          city: "City",
          stadium: "Stadium",
          foundedYear: null,
          location: "Location",
          logoUrl: null,
          rosterLimit: 53,
        });
        const playerIds: Id<"players">[] = [];
        for (let player = 0; player < 3; player++) {
          playerIds.push(
            await ctx.db.insert("players", {
              name: `H${history} Player ${player}`,
              leagueId,
              teamId,
              position: "ATH",
              positionGroup: null,
              jerseyNumber: player + 1,
              dateOfBirth: null,
              status: "active",
              headshotUrl: null,
            }),
          );
        }
        const expected = new Map<string, Record<string, Record<string, number>>>(
          playerIds.map((id) => [id as string, {}]),
        );
        const seasonIds: Id<"seasons">[] = [];
        const seasonCount = 2 + randomInt(4);
        for (let season = 0; season < seasonCount; season++) {
          const seasonId = await ctx.db.insert("seasons", {
            name: `${2030 + season}`,
            leagueId,
            startDate: null,
            endDate: null,
            status: "completed",
            rosterLocked: false,
          });
          seasonIds.push(seasonId);
          for (const playerId of playerIds) {
            const totals = {
              passing: {
                yards: randomInt(3000),
                td: randomInt(40),
              },
              rushing: {
                yards: randomInt(1200),
                long: randomInt(90),
              },
              defense: {
                sacks: randomInt(15),
                int: randomInt(8),
              },
            };
            const playerExpected = expected.get(playerId as string)!;
            for (const [group, fields] of Object.entries(totals)) {
              const target = (playerExpected[group] =
                playerExpected[group] ?? {});
              for (const [key, value] of Object.entries(fields)) {
                target[key] = (target[key] ?? 0) + value;
              }
            }
            await ctx.db.insert("playerSeasonAggregates", {
              leagueId,
              seasonId,
              teamId,
              playerId,
              position: "ATH",
              positionGroup: null,
              gamesPlayed: 10,
              totalsJson: JSON.stringify(totals),
              updatedAt: new Date(0).toISOString(),
            });
          }
        }
        return {
          leagueId,
          playerIds,
          seasonIds,
          expected: Object.fromEntries(expected),
        };
      });

      for (const seasonId of seeded.seasonIds) {
        await t.mutation(internal.history.finalizeSeasonHistory, { seasonId });
      }
      await t.run(async (ctx) => {
        const rows = await ctx.db
          .query("playerCareerTotals")
          .withIndex("by_leagueId", (q) =>
            q.eq("leagueId", seeded.leagueId),
          )
          .collect();
        expect(rows).toHaveLength(seeded.playerIds.length);
        for (const row of rows) {
          expect(JSON.parse(row.totalsJson)).toEqual(
            seeded.expected[row.playerId as string],
          );
        }
      });
    }
  });
});

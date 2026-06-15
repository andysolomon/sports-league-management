import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { LeagueImportSchema } from "@sports-management/api-contracts";
import {
  bulkImportLeague,
  createFixture,
  getLeagueByName,
  getTeamsByLeague,
  recordGameResult,
  upsertSeason,
} from "@/lib/data-api";
import { resolveForkTargetOrg } from "@/lib/fork-target-org";
import { resolveOrgContext } from "@/lib/org-context";
import { handleApiError } from "@/lib/api-error";

/**
 * One-time migration of a browser-local workspace into the signed-in user's
 * account (WSM-000137 AC #3). The client POSTs the serialized local workspace
 * (see serializeLocalWorkspace). We:
 *   1. import the league/divisions/teams/players via the EXISTING, tested
 *      bulkImportLeague funnel (reused from #248), scoped to the user's org;
 *   2. re-key seasons + schedule by name onto the freshly-created server ids and
 *      create them via the existing season/fixture/result mutations.
 * No new Convex functions — all writes go through internal mutations the server
 * already exposes. The client clears local mode on success.
 */
export async function POST(request: NextRequest) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // The league/divisions head must be a valid import payload.
    const core = LeagueImportSchema.safeParse({
      league: body.league,
      divisions: body.divisions,
    });
    if (!core.success) {
      return NextResponse.json(
        { error: "Invalid workspace", issues: core.error.issues.slice(0, 8) },
        { status: 400 },
      );
    }

    // Land the imported league in an org the user admins (active/admin/new).
    const { targetOrgId, createdOrg } = await resolveForkTargetOrg({
      userId,
      orgId,
      orgRole,
      newOrgName: core.data.league.name,
    });

    const importResult = await bulkImportLeague(
      core.data,
      userId,
      targetOrgId,
    );

    // Resolve the freshly-created league + its server team ids (by name) so the
    // schedule can be attached to the right rows.
    const league = await getLeagueByName(core.data.league.name);
    if (!league) {
      // Import succeeded but we can't find the league — return the core result.
      return NextResponse.json({
        ok: true,
        orgId: targetOrgId,
        createdOrg,
        imported: importResult.created,
        seasons: 0,
        fixtures: 0,
      });
    }

    const orgContext = await resolveOrgContext(userId);
    const serverTeams = await getTeamsByLeague(league.id, orgContext);
    const teamIdByName = new Map(serverTeams.map((t) => [t.name, t.id]));

    // Seasons → server ids, keyed by name.
    const seasons = Array.isArray(body.seasons) ? body.seasons : [];
    const seasonIdByName = new Map<string, string>();
    for (const s of seasons) {
      const { dto } = await upsertSeason({
        name: String(s.name),
        leagueId: league.id,
        startDate: s.startDate ?? null,
        endDate: s.endDate ?? null,
        status: "active",
      });
      seasonIdByName.set(dto.name, dto.id);
    }

    // Fixtures (+ results), mapping team/season names → server ids.
    const fixtures = Array.isArray(body.fixtures) ? body.fixtures : [];
    let fixturesCreated = 0;
    for (const f of fixtures) {
      const seasonId = seasonIdByName.get(String(f.seasonName));
      const homeTeamId = teamIdByName.get(String(f.homeTeamName));
      const awayTeamId = teamIdByName.get(String(f.awayTeamName));
      if (!seasonId || !homeTeamId || !awayTeamId) continue;

      const fixture = await createFixture({
        seasonId,
        homeTeamId,
        awayTeamId,
        scheduledAt: f.scheduledAt ?? null,
        week: typeof f.week === "number" ? f.week : null,
        venue: f.venue ?? null,
        actorUserId: userId,
      });
      fixturesCreated += 1;

      if (
        f.result &&
        typeof f.result.homeScore === "number" &&
        typeof f.result.awayScore === "number"
      ) {
        await recordGameResult({
          fixtureId: fixture.id,
          homeScore: f.result.homeScore,
          awayScore: f.result.awayScore,
          actorUserId: userId,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      orgId: targetOrgId,
      createdOrg,
      leagueId: league.id,
      imported: importResult.created,
      seasons: seasonIdByName.size,
      fixtures: fixturesCreated,
    });
  } catch (error) {
    return handleApiError(error, "/api/local/migrate");
  }
}

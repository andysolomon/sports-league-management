import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { statKeepingV1 } from "@/lib/flags";
import { canManageTeam } from "@/lib/authorization";
import { resolveOrgContext } from "@/lib/org-context";
import {
  getTeam,
  getFixture,
  getPlayersByTeam,
  getPlayerGameStatsByFixture,
} from "@/lib/data-api";
import {
  generateMaxPrepsTxt,
  SUPPLIER_ID_PLACEHOLDER,
} from "@/lib/maxpreps-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * MaxPreps stat-import file download (WSM-000112, PR4). Authed GET → attachment.
 * Builds the pipe-delimited .txt for one team's entered stats in a game. The
 * 32-char Supplier ID is a build-time, account-bound credential (env
 * MAXPREPS_SUPPLIER_ID); when unset, a clearly-marked placeholder goes on line 1
 * for the coach to replace.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; gameId: string }> },
) {
  if (!(await statKeepingV1())) {
    return NextResponse.json({ error: "flag_disabled" }, { status: 403 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { teamId, gameId } = await params;
  if (!(await canManageTeam(teamId, userId))) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  const orgContext = await resolveOrgContext(userId);
  const [team, fixture] = await Promise.all([
    getTeam(teamId, orgContext).catch(() => null),
    getFixture(gameId),
  ]);
  if (!team || !fixture) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (fixture.homeTeamId !== teamId && fixture.awayTeamId !== teamId) {
    return NextResponse.json({ error: "team_not_in_fixture" }, { status: 404 });
  }

  const [players, entered] = await Promise.all([
    getPlayersByTeam(teamId, orgContext),
    getPlayerGameStatsByFixture(gameId),
  ]);
  const statsByPlayer = new Map(
    entered.filter((s) => s.teamId === teamId).map((s) => [s.playerId, s.stats]),
  );
  const rows = players
    .filter((p) => p.jerseyNumber != null && statsByPlayer.has(p.id))
    .map((p) => ({
      jersey: p.jerseyNumber as number,
      stats: statsByPlayer.get(p.id)!,
    }));

  const supplierId = process.env.MAXPREPS_SUPPLIER_ID || SUPPLIER_ID_PLACEHOLDER;
  const { text } = generateMaxPrepsTxt(supplierId, rows);

  // MaxPreps filename must not contain quotes or parentheses.
  const slug = team.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const wk = fixture.week != null ? `wk${fixture.week}` : "game";
  const filename = `maxpreps-${slug}-${wk}.txt`;

  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

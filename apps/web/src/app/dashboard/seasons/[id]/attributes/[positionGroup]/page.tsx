import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { playerAttributesV1 } from "@/lib/flags";
import {
  getSeason,
  getSeasonAttributesByPosition,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/8bit/card";
import {
  POSITION_GROUPS,
  isValidPositionGroup,
} from "@/lib/attributes/position-groups";

const TOP_LIMIT = 50;
const TOP_ATTRIBUTES_SHOWN = 3;

function topAttributes(
  attributes: Record<string, number>,
  n = TOP_ATTRIBUTES_SHOWN,
): Array<{ key: string; value: number }> {
  return Object.entries(attributes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([key, value]) => ({ key, value }));
}

export default async function SeasonAttributesByPositionPage({
  params,
}: {
  params: Promise<{ id: string; positionGroup: string }>;
}) {
  const enabled = await playerAttributesV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: seasonId, positionGroup } = await params;

  if (!isValidPositionGroup(positionGroup)) notFound();

  const orgContext = await resolveOrgContext(userId);
  const season = await getSeason(seasonId, orgContext).catch(() => null);
  if (!season) notFound();

  const rows = await getSeasonAttributesByPosition(
    seasonId,
    positionGroup,
    TOP_LIMIT,
  );

  return (
    <div>
      <Link
        href={`/dashboard/seasons/${seasonId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Season
      </Link>

      <header className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          Top {positionGroup}s — {season.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Ranked by weighted overall · top {TOP_LIMIT}
        </p>
      </header>

      <nav
        aria-label="Position groups"
        className="mb-6 flex flex-wrap gap-2 text-xs font-mono"
      >
        {POSITION_GROUPS.map((group) => (
          <Link
            key={group}
            href={`/dashboard/seasons/${seasonId}/attributes/${group}`}
            className={`border-2 px-2 py-1 transition-colors ${
              group === positionGroup
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {group}
          </Link>
        ))}
      </nav>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted text-left text-foreground">
                <th className="px-4 py-2 font-mono text-xs uppercase">
                  Rank
                </th>
                <th className="px-4 py-2 font-mono text-xs uppercase">
                  Player
                </th>
                <th className="px-4 py-2 text-right font-mono text-xs uppercase">
                  Overall
                </th>
                <th className="px-4 py-2 font-mono text-xs uppercase">
                  Top attributes
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No attribute data ingested for {positionGroup}s in this
                    season yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.playerId} className="border-b border-border">
                    <td className="px-4 py-2 font-mono text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2 text-foreground">
                      <Link
                        href={`/dashboard/players/${row.playerId}/development`}
                        className="hover:underline"
                      >
                        {row.playerName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">
                      {row.weightedOverall === null
                        ? "—"
                        : row.weightedOverall.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {topAttributes(row.attributes)
                        .map((a) => `${a.key}:${a.value.toFixed(0)}`)
                        .join("  ·  ") || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

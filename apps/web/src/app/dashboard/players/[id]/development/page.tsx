import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { playerAttributesV1 } from "@/lib/flags";
import {
  getPlayer,
  getPlayerDevelopment,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/8bit/card";
import PixelLineChart from "@/components/attributes/PixelLineChart";

export default async function PlayerDevelopmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await playerAttributesV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: playerId } = await params;

  // Resolve the user's visible leagues, then fetch the player through
  // the access check. Anything outside the user's org tree → 404.
  const orgContext = await resolveOrgContext(userId);
  const player = await getPlayer(playerId, orgContext).catch(() => null);
  if (!player) notFound();

  const development = await getPlayerDevelopment(playerId);

  const points = development.map((row) => ({
    x: row.seasonName,
    y: row.weightedOverall,
  }));

  // Latest two rows for the headline delta call-out.
  const last = development[development.length - 1] ?? null;
  const headlineDelta = last?.delta ?? null;

  return (
    <div>
      <Link
        href={`/dashboard/players`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Players
      </Link>

      <header className="mb-6 flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-foreground">
          {player.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Position: {player.position}
          {player.positionGroup ? ` · ${player.positionGroup}` : ""}
        </p>
      </header>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-4 flex items-baseline gap-3">
            <h3 className="text-lg font-semibold text-foreground">
              Weighted overall by season
            </h3>
            {headlineDelta !== null ? (
              <span
                className={`font-mono text-sm ${
                  headlineDelta >= 0 ? "text-accent" : "text-destructive"
                }`}
              >
                {headlineDelta >= 0 ? "+" : ""}
                {headlineDelta.toFixed(1)} vs last season
              </span>
            ) : null}
          </div>
          <PixelLineChart
            points={points}
            ariaLabel={`${player.name} weighted overall by season`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted text-left text-foreground">
                <th className="px-4 py-2 font-mono text-xs uppercase">
                  Season
                </th>
                <th className="px-4 py-2 font-mono text-xs uppercase">
                  Position group
                </th>
                <th className="px-4 py-2 text-right font-mono text-xs uppercase">
                  Overall
                </th>
                <th className="px-4 py-2 text-right font-mono text-xs uppercase">
                  Δ
                </th>
              </tr>
            </thead>
            <tbody>
              {development.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No attribute data ingested yet for this player.
                  </td>
                </tr>
              ) : (
                development.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="px-4 py-2 text-foreground">
                      {row.seasonName}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.positionGroup}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">
                      {row.weightedOverall === null
                        ? "—"
                        : row.weightedOverall.toFixed(1)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono ${
                        row.delta === null
                          ? "text-muted-foreground"
                          : row.delta >= 0
                            ? "text-accent"
                            : "text-destructive"
                      }`}
                    >
                      {row.delta === null
                        ? "—"
                        : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(1)}`}
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

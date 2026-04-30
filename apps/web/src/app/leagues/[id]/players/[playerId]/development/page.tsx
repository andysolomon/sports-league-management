import { notFound } from "next/navigation";
import Link from "next/link";
import { playerAttributesV1 } from "@/lib/flags";
import { getPlayerDevelopmentPublic } from "@/lib/data-api";
import { publicLeagueGuard } from "@/lib/public-league-guard";
import { Card, CardContent } from "@/components/ui/8bit/card";
import PixelLineChart from "@/components/attributes/PixelLineChart";
import { trackPlayerAttributesView } from "@/lib/analytics";

/*
 * Public viewer route (Phase 2 / WSM-000061).
 *
 * NO Clerk session required. Visibility is the league's own opt-in
 * via `leagues.isPublic`; `publicLeagueGuard` 404s if missing or
 * private. Middleware whitelists `/leagues/(.*)` so this page is
 * reachable for unauthenticated visitors.
 *
 * Layout is intentionally chrome-light — just the chart + table —
 * because the dashboard sidebar doesn't wrap routes outside `/dashboard/`.
 */
export default async function PublicPlayerDevelopmentPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const enabled = await playerAttributesV1();
  if (!enabled) notFound();

  const { id: leagueId, playerId } = await params;

  await publicLeagueGuard(leagueId);

  const development = await getPlayerDevelopmentPublic(leagueId, playerId);
  if (development === null) notFound();
  void trackPlayerAttributesView({ playerId, route: "public" });

  const points = development.map((row) => ({
    x: row.seasonName,
    y: row.weightedOverall,
  }));

  const last = development[development.length - 1] ?? null;
  const headlineDelta = last?.delta ?? null;
  const headlinePosition = last?.positionGroup ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/leagues/${leagueId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to League
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Player Development
        </h1>
        {headlinePosition ? (
          <p className="text-sm text-muted-foreground">
            Position group: {headlinePosition}
          </p>
        ) : null}
      </header>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Weighted overall by season
            </h2>
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
            ariaLabel="Weighted overall by season"
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
                    No attribute data published yet for this player.
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

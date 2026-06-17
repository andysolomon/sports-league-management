import type { PlayerGameStatLine } from "@sports-management/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { STAT_GROUPS } from "@/lib/stat-groups";

/*
 * Read-only season stat line (WSM-000112, PR3) — the aggregated box-score
 * totals from getPlayerSeasonTotals, rendered group by group. Only groups/fields
 * the player actually accumulated are shown. Presentational; safe to server-render.
 */
export function SeasonStatsCard({
  stats,
  gameCount,
  seasonName,
}: {
  stats: PlayerGameStatLine;
  gameCount: number;
  seasonName: string;
}) {
  const groups = STAT_GROUPS.map((g) => {
    const groupStats = stats[g.key] as Record<string, number> | undefined;
    const fields = g.fields.filter(
      (f) => typeof groupStats?.[f.key] === "number",
    );
    return { def: g, groupStats, fields };
  }).filter((g) => g.fields.length > 0);

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold text-foreground">Season stats</h3>
          <span className="text-sm text-muted-foreground">
            {seasonName} · {gameCount} game{gameCount === 1 ? "" : "s"}
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No stats recorded yet this season.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map(({ def, groupStats, fields }) => (
              <div key={def.key}>
                <p className="mb-1.5 text-xs font-semibold text-foreground">
                  {def.label}
                </p>
                <dl className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {fields.map((f) => (
                    <div key={f.key} className="flex items-baseline gap-1.5">
                      <dt className="text-xs text-muted-foreground">{f.label}</dt>
                      <dd className="font-mono text-sm font-medium tabular-nums text-foreground">
                        {groupStats?.[f.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

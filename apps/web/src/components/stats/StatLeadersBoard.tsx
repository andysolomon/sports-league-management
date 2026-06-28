import type { SeasonStatCategoryLeaders } from "@/lib/data-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/*
 * Season stat-leaders board (WSM-000186) — a card per stat category with the
 * top players. Only categories that have data render, so a pass-only week
 * doesn't show empty defensive cards. Read-only display.
 */
export function StatLeadersBoard({
  categories,
}: {
  categories: SeasonStatCategoryLeaders[];
}) {
  const withData = categories.filter((c) => c.leaders.length > 0);

  if (withData.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No stats entered yet this season. Leaders appear here once coaches
          record game stats.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {withData.map((cat) => (
        <Card key={cat.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{cat.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ol className="divide-y divide-border">
              {cat.leaders.map((leader, i) => (
                <li
                  key={leader.playerId}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-foreground">
                        {leader.jerseyNumber != null ? `#${leader.jerseyNumber} ` : ""}
                        {leader.playerName}
                      </span>
                      <span className="ml-1 text-muted-foreground">
                        · {leader.teamName}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums font-semibold text-foreground">
                    {leader.value}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

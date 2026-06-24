import { Card, CardContent } from "@/components/ui/card";

/*
 * HS SPRT rating from real game stats (WSM-000112, PR5). Same look as the
 * nflverse SPRT card, but the number is earned from the player's own entered
 * box scores (z-scored within the season cohort). Presentational.
 */

const LABELS: Record<string, string> = {
  efficiency: "Efficiency",
  production: "Production",
  scoring: "Scoring",
  mobility: "Mobility",
  volume: "Volume",
  catches: "Catches",
  receiving: "Receiving",
  passRush: "Pass rush",
  runStop: "Run stop",
  tackling: "Tackling",
  coverage: "Coverage",
  ballHawk: "Ball hawk",
};

const label = (key: string) =>
  LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);

export function HsRatingCard({
  overall,
  attributes,
}: {
  overall: number;
  attributes: Record<string, number>;
}) {
  const components = Object.entries(attributes);

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            SPRT Rating
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              from game stats
            </span>
          </h3>
          <span className="font-mono text-2xl font-bold text-accent">
            {overall}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              OVR
            </span>
          </span>
        </div>

        {components.length > 0 && (
          <dl className="mt-4 space-y-2">
            {components.map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <dt className="w-32 shrink-0 text-sm text-muted-foreground">
                  {label(key)}
                </dt>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={99}
                  aria-label={label(key)}
                >
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${Math.min(100, (value / 99) * 100)}%` }}
                  />
                </div>
                <dd className="w-8 shrink-0 text-right font-mono text-sm text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Derived from this player&apos;s entered game stats, ranked against
          others at their position this season.
        </p>
      </CardContent>
    </Card>
  );
}

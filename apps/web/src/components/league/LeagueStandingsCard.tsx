import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Standing } from "@sports-management/shared-types";

export interface LeagueStandingsCardProps {
  standings: Standing[];
  fullStandingsHref: string | null;
}

export function LeagueStandingsCard({
  standings,
  fullStandingsHref,
}: LeagueStandingsCardProps) {
  const topFive = standings.slice(0, 5);

  return (
    <Card data-testid="league-standings-card">
      <CardHeader>
        <CardTitle>Standings</CardTitle>
      </CardHeader>
      <CardContent>
        {topFive.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No recorded results yet.
          </p>
        ) : (
          <ol className="space-y-2 text-sm">
            {topFive.map((row, index) => (
              <li
                key={row.teamId}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <Link
                    href={`/dashboard/teams/${row.teamId}`}
                    className="truncate text-foreground hover:underline"
                  >
                    {row.teamName}
                  </Link>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {row.wins}&ndash;{row.losses}
                  {row.ties > 0 ? `–${row.ties}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        {fullStandingsHref && standings.length > 0 ? (
          <Link
            href={fullStandingsHref}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Full standings &rarr;
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

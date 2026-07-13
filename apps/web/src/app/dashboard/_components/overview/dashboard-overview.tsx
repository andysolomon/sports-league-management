import Link from "next/link";
import { Calendar, Trophy } from "lucide-react";
import type { LeagueDto, SeasonDto, Standing } from "@sports-management/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { TeamMark } from "@/components/team-mark";
import type { RegularSeasonProgress } from "@/lib/playoffs";

export function findActiveSeason(seasons: SeasonDto[]): SeasonDto | null {
  return seasons.find((s) => s.status.toLowerCase() === "active") ?? null;
}

function formatRecord(wins: number, losses: number, ties: number): string {
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}

interface DashboardOverviewProps {
  league: LeagueDto;
  activeSeason: SeasonDto | null;
  teamCount: number;
  progress: RegularSeasonProgress;
  standings: Standing[];
  standingsLinkEnabled: boolean;
}

export function DashboardOverview({
  league,
  activeSeason,
  teamCount,
  progress,
  standings,
  standingsLinkEnabled,
}: DashboardOverviewProps) {
  if (!activeSeason) {
    return (
      <div data-testid="overview-no-active-season">
        <EmptyState
          icon={Calendar}
          title="No active season"
          description="Activate or create a season to see progress and standings here."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/seasons">Go to Seasons</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const topFive = standings.slice(0, 5);
  const standingsHref = activeSeason
    ? `/dashboard/leagues/${league.id}/standings`
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="dashboard-overview">
      <Card data-testid="league-summary-card">
        <CardContent className="space-y-0">
          <div className="mb-3.5 flex items-center gap-2.5">
            <Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <h3 className="text-title-22 font-semibold text-foreground">
              {league.name}
            </h3>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Active season</dt>
              <dd className="text-foreground" data-testid="overview-active-season">
                {activeSeason?.name ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Regular season</dt>
              <dd
                className="font-mono tabular-nums text-foreground"
                data-testid="overview-season-progress"
              >
                {progress.final} / {progress.total} played
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Teams</dt>
              <dd
                className="font-mono tabular-nums text-foreground"
                data-testid="overview-team-count"
              >
                {teamCount}
              </dd>
            </div>
          </dl>

          <div className="mt-3.5 flex flex-wrap gap-2">
            <Button asChild variant="default" size="sm">
              <Link href={`/dashboard/leagues/${league.id}`}>Open league</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/seasons">Seasons</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="standings-card">
        <CardContent>
          <h3 className="mb-3.5 text-title-22 font-semibold text-foreground">
            Standings
          </h3>
          <ol
            className="space-y-2 text-sm"
            data-testid="overview-standings-rows"
          >
            {topFive.map((row) => (
              <li
                key={row.teamId}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">
                    {row.leagueRank}
                  </span>
                  <TeamMark name={row.teamName} size="sm" />
                  {standingsHref ? (
                    <Link
                      href={standingsHref}
                      className="truncate text-foreground hover:underline"
                    >
                      {row.teamName}
                    </Link>
                  ) : (
                    <span className="truncate text-foreground">{row.teamName}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {formatRecord(row.wins, row.losses, row.ties)}
                </span>
              </li>
            ))}
          </ol>
          {standingsLinkEnabled && standingsHref && (
            <Link
              href={standingsHref}
              className="mt-3.5 inline-block text-sm text-primary hover:underline"
              data-testid="overview-full-standings-link"
            >
              Full standings →
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

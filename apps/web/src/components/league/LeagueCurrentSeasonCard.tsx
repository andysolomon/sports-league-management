import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";

export interface LeagueCurrentSeasonCardProps {
  season: {
    id: string;
    name: string;
    status: string;
    playoffTeams: number | null;
    playoffFormat: string | null;
  } | null;
  progress: { final: number; total: number };
  navLinks: { href: string; label: string }[];
}

function formatPlayoffFormat(playoffFormat: string | null): string {
  if (playoffFormat === "double") return "double elimination";
  return "single elimination";
}

export function LeagueCurrentSeasonCard({
  season,
  progress,
  navLinks,
}: LeagueCurrentSeasonCardProps) {
  return (
    <Card data-testid="league-current-season">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Current season</CardTitle>
        {season ? <StatusBadge status={season.status} /> : null}
      </CardHeader>
      <CardContent>
        {!season ? (
          <p className="text-sm text-muted-foreground">No active season.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Season</span>
              <Link
                href={`/dashboard/seasons/${season.id}`}
                className="text-accent hover:underline"
              >
                {season.name} <span aria-hidden>&rarr;</span>
              </Link>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Regular season</span>
              <span className="font-mono tabular-nums text-foreground">
                {progress.final} / {progress.total} played
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Playoff format</span>
              <span className="text-foreground">
                {season.playoffTeams
                  ? `${season.playoffTeams} teams · ${formatPlayoffFormat(season.playoffFormat)}`
                  : "Not configured"}
              </span>
            </div>
            {navLinks.length > 0 ? <WorkspaceNav links={navLinks} /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

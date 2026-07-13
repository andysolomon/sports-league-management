import Link from "next/link";
import type { Standing, TeamDto } from "@sports-management/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamMark } from "@/components/team-mark";
import { formatTeamRecord } from "@/lib/game-drawer-projection";

export interface LeagueTeamsGridProps {
  teams: TeamDto[];
  standings: Standing[];
  standingsHref: string | null;
  recordByTeamId: Map<string, { wins: number; losses: number; ties: number }>;
}

export function LeagueTeamsGrid({
  teams,
  standings,
  standingsHref,
  recordByTeamId,
}: LeagueTeamsGridProps) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const orderedTeamIds = [
    ...standings.map((row) => row.teamId),
    ...teams
      .map((team) => team.id)
      .filter((id) => !standings.some((row) => row.teamId === id))
      .sort((a, b) =>
        (teamById.get(a)?.name ?? "").localeCompare(teamById.get(b)?.name ?? ""),
      ),
  ];

  return (
    <Card data-testid="league-teams-grid">
      <CardHeader>
        <CardTitle>
          Teams{" "}
          <span className="font-normal text-muted-foreground">
            ({teams.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orderedTeamIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orderedTeamIds.map((teamId) => {
              const team = teamById.get(teamId);
              if (!team) return null;

              const record = recordByTeamId.get(team.id);
              const recordLabel = record
                ? formatTeamRecord(record.wins, record.losses, record.ties)
                : "0-0";
              const mascot = team.teamName?.trim();
              const subtitle = mascot
                ? `${recordLabel} · ${mascot}`
                : recordLabel;
              const href =
                standingsHref ?? `/dashboard/teams/${team.id}`;

              return (
                <li key={team.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary"
                  >
                    <TeamMark
                      name={team.name}
                      primaryColor={team.primaryColor}
                      size="md"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {team.name}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {subtitle}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

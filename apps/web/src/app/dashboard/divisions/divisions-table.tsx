"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Standing } from "@sports-management/shared-types";
import { TeamMark } from "@/components/team-mark";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatTeamRecord } from "@/lib/game-drawer-projection";
import { Layers, Trophy } from "lucide-react";
import {
  CreateDivisionButton,
  DivisionRowActions,
} from "../leagues/division-controls";

export interface DivisionPanel {
  id: string;
  name: string;
  rows: Standing[];
  teamColors: Record<string, string | null>;
}

interface DivisionsTableProps {
  divisions: DivisionPanel[];
  isAdmin: boolean;
  activeLeagueId: string | null;
  activeSeasonName: string | null;
  hasPlayedGames: boolean;
  standingsHref: string | null;
}

export function DivisionsTable({
  divisions,
  isAdmin,
  activeLeagueId,
  activeSeasonName,
  hasPlayedGames,
  standingsHref,
}: DivisionsTableProps) {
  const router = useRouter();

  if (divisions.length === 0) {
    return (
      <div className="space-y-4">
        {isAdmin && activeLeagueId ? (
          <div className="flex justify-end">
            <CreateDivisionButton leagueId={activeLeagueId} />
          </div>
        ) : null}
        <EmptyState
          icon={Layers}
          title="No divisions found"
          description={
            isAdmin && activeLeagueId
              ? "Create a division to start grouping teams."
              : "Divisions will appear here once created in the system."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
        {isAdmin && activeLeagueId ? (
          <CreateDivisionButton leagueId={activeLeagueId} />
        ) : null}
        <Link href="/dashboard/teams" className="text-primary hover:underline">
          Teams &rarr;
        </Link>
        {standingsHref ? (
          <Link href={standingsHref} className="text-primary hover:underline">
            Full standings &rarr;
          </Link>
        ) : null}
      </div>

      {!activeSeasonName ? (
        <Card className="px-6 py-8 text-center text-sm text-muted-foreground">
          No active season yet — division standings will appear once a season is
          underway.
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {divisions.map((division) => {
          const leader = hasPlayedGames ? division.rows[0] : null;
          return (
            <Card key={division.id} className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Layers className="h-[18px] w-[18px] shrink-0 text-accent" />
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {division.name}
                  </h3>
                  <Badge variant="outline">{division.rows.length}</Badge>
                  {isAdmin ? (
                    <DivisionRowActions
                      divisionId={division.id}
                      currentName={division.name}
                      teamCount={division.rows.length}
                    />
                  ) : null}
                </div>
                {leader ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="truncate">{leader.teamName}</span>
                  </span>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[380px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="w-9 px-4 py-2 text-left text-label-12 font-medium uppercase tracking-wide text-muted-foreground">
                        #
                      </th>
                      <th className="px-4 py-2 text-left text-label-12 font-medium uppercase tracking-wide text-muted-foreground">
                        Team
                      </th>
                      <th className="px-4 py-2 text-right text-label-12 font-medium uppercase tracking-wide text-muted-foreground">
                        Record
                      </th>
                      <th className="px-4 py-2 text-right text-label-12 font-medium uppercase tracking-wide text-muted-foreground">
                        PF
                      </th>
                      <th className="px-4 py-2 text-right text-label-12 font-medium uppercase tracking-wide text-muted-foreground">
                        Diff
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {division.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-sm text-muted-foreground"
                        >
                          No teams in this division.
                        </td>
                      </tr>
                    ) : (
                      division.rows.map((row) => {
                        const diff = row.pointsFor - row.pointsAgainst;
                        return (
                          <tr
                            key={row.teamId}
                            className="cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                            onClick={() =>
                              router.push(
                                `/dashboard/teams/${row.teamId}?from=divisions`,
                              )
                            }
                          >
                            <td className="px-4 py-2.5 font-mono text-muted-foreground">
                              {row.divisionRank}
                            </td>
                            <td className="px-4 py-2.5 text-foreground">
                              <span className="inline-flex min-w-0 items-center gap-2">
                                <TeamMark
                                  name={row.teamName}
                                  primaryColor={
                                    division.teamColors[row.teamId] ?? null
                                  }
                                  size="sm"
                                />
                                <span className="truncate">{row.teamName}</span>
                                {hasPlayedGames && row.divisionRank === 1 ? (
                                  <Badge variant="success">Leader</Badge>
                                ) : null}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
                              {formatTeamRecord(row.wins, row.losses, row.ties)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
                              {row.pointsFor}
                            </td>
                            <td
                              className={
                                diff > 0
                                  ? "px-4 py-2.5 text-right font-mono tabular-nums text-accent"
                                  : diff < 0
                                    ? "px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground"
                                    : "px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground"
                              }
                            >
                              {diff > 0 ? "+" : ""}
                              {diff}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

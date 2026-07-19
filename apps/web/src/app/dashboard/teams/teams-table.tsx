"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import type { Standing, TeamDto } from "@sports-management/shared-types";
import { TeamMark } from "@/components/team-mark";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatStandingRecord,
  standingPointDifferential,
} from "@/lib/teams-table";
import { cn } from "@/lib/utils";

export interface TeamsTableRow {
  team: TeamDto;
  standing: Standing;
  divisionName: string | null;
  rosterCount: number;
  rosterLimit: number;
}

export interface TeamsTableProps {
  rows: TeamsTableRow[];
  onQuickView: (teamId: string) => void;
}

export function TeamsTable({ rows, onQuickView }: TeamsTableProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0" data-testid="teams-table">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 px-4">#</TableHead>
            <TableHead className="px-4">Team</TableHead>
            <TableHead className="px-4">Division</TableHead>
            <TableHead className="px-4 text-right">Record</TableHead>
            <TableHead className="px-4 text-right">PF</TableHead>
            <TableHead className="px-4 text-right">Diff</TableHead>
            <TableHead className="px-4 text-right">Roster</TableHead>
            <TableHead className="w-12 px-2" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const diff = standingPointDifferential(row.standing);
            const mascot = row.team.teamName?.trim();

            return (
              <TableRow
                key={row.team.id}
                data-testid="team-row"
              >
                <TableCell className="px-4 font-mono text-muted-foreground">
                  {row.standing.leagueRank}
                </TableCell>
                <TableCell className="px-4">
                  <span className="inline-flex items-center gap-2.5">
                    <TeamMark
                      name={row.team.name}
                      primaryColor={row.team.primaryColor}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <Link
                        href={`/dashboard/teams/${row.team.id}`}
                        className="block font-semibold text-foreground hover:underline"
                      >
                        {row.team.name}
                      </Link>
                      {mascot ? (
                        <span className="block text-xs text-muted-foreground">
                          {mascot}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="px-4 text-muted-foreground">
                  {row.divisionName ?? "—"}
                </TableCell>
                <TableCell className="px-4 text-right font-mono tabular-nums">
                  {formatStandingRecord(row.standing)}
                </TableCell>
                <TableCell className="px-4 text-right font-mono tabular-nums">
                  {row.standing.pointsFor}
                </TableCell>
                <TableCell
                  className={cn(
                    "px-4 text-right font-mono tabular-nums",
                    diff > 0
                      ? "text-accent"
                      : diff < 0
                        ? "text-muted-foreground"
                        : "text-muted-foreground/80",
                  )}
                >
                  {diff > 0 ? "+" : ""}
                  {diff}
                </TableCell>
                <TableCell className="px-4 text-right font-mono tabular-nums">
                  {row.rosterCount}/{row.rosterLimit}
                </TableCell>
                <TableCell className="px-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quick view ${row.team.name}`}
                    title={`Quick view ${row.team.name}`}
                    onClick={() => onQuickView(row.team.id)}
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

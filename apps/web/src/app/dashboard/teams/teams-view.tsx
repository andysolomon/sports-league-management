"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";
import { TeamsTable, type TeamsTableRow } from "./teams-table";
import {
  TeamDetailSheet,
  type TeamDetailSheetData,
} from "./team-detail-sheet";

export interface TeamsViewProps {
  teamCount: number;
  seasonName: string | null;
  rows: TeamsTableRow[];
  sheetDataByTeamId: Record<string, TeamDetailSheetData>;
  leagueId: string | null;
  scheduleLinksEnabled: boolean;
  hasActiveSeason: boolean;
}

export function TeamsView({
  teamCount,
  seasonName,
  rows,
  sheetDataByTeamId,
  leagueId,
  scheduleLinksEnabled,
  hasActiveSeason,
}: TeamsViewProps) {
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
  const selectedData = selectedTeamId
    ? (sheetDataByTeamId[selectedTeamId] ?? null)
    : null;

  const description =
    seasonName != null
      ? `${teamCount} teams · ${seasonName}`
      : `${teamCount} teams`;

  return (
    <div>
      <PageHeader
        title="Teams"
        description={description}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{teamCount}</Badge>
            <Link
              href="/dashboard/divisions"
              className="text-sm text-primary hover:underline"
            >
              Divisions →
            </Link>
            <Link
              href="/dashboard/players"
              className="text-sm text-primary hover:underline"
            >
              Players →
            </Link>
          </div>
        }
      />

      {!hasActiveSeason ? (
        <EmptyState
          icon={Users}
          title="No active season"
          description="Activate or create a season to see team standings here."
          action={
            <Link
              href="/dashboard/seasons"
              className="text-sm text-primary hover:underline"
            >
              Go to Seasons →
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams found"
          description="Teams will appear here once added to the league."
        />
      ) : (
        <TeamsTable
          rows={rows}
          onRowClick={(teamId) => setSelectedTeamId(teamId)}
        />
      )}

      {leagueId ? (
        <TeamDetailSheet
          data={selectedData}
          open={selectedTeamId != null && selectedData != null}
          onOpenChange={(open) => {
            if (!open) setSelectedTeamId(null);
          }}
          leagueId={leagueId}
          scheduleLinksEnabled={scheduleLinksEnabled}
        />
      ) : null}
    </div>
  );
}

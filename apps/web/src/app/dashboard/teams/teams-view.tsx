"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";
import {
  DivisionsTable,
  type DivisionPanel,
} from "../divisions/divisions-table";
import { TeamsTable, type TeamsTableRow } from "./teams-table";
import {
  TeamDetailSheet,
  type TeamDetailSheetData,
} from "./team-detail-sheet";
import {
  divisionsViewHref,
  type TeamsHomeView,
} from "./teams-home-navigation";

export interface TeamsViewProps {
  teamCount: number;
  seasonName: string | null;
  rows: TeamsTableRow[];
  sheetDataByTeamId: Record<string, TeamDetailSheetData>;
  leagueId: string | null;
  scheduleLinksEnabled: boolean;
  hasActiveSeason: boolean;
  currentView: TeamsHomeView;
  divisions: DivisionPanel[];
  isAdmin: boolean;
  activeSeasonName: string | null;
  hasPlayedGames: boolean;
  standingsHref: string | null;
  selectedDivisionId: string | null;
}

export function TeamsView({
  teamCount,
  seasonName,
  rows,
  sheetDataByTeamId,
  leagueId,
  scheduleLinksEnabled,
  hasActiveSeason,
  currentView,
  divisions,
  isAdmin,
  activeSeasonName,
  hasPlayedGames,
  standingsHref,
  selectedDivisionId,
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
              href="/dashboard/players"
              className="text-sm text-primary hover:underline"
            >
              Players →
            </Link>
          </div>
        }
      />

      <nav
        aria-label="Teams Home views"
        className="mb-5 flex items-center gap-4 border-b border-border text-sm font-medium"
      >
        <Link
          href="/dashboard/teams"
          aria-current={currentView === "teams" ? "page" : undefined}
          className={
            currentView === "teams"
              ? "border-b-2 border-primary pb-2 text-foreground"
              : "pb-2 text-muted-foreground hover:text-foreground"
          }
        >
          Teams
        </Link>
        <Link
          href={divisionsViewHref()}
          aria-current={currentView === "divisions" ? "page" : undefined}
          className={
            currentView === "divisions"
              ? "border-b-2 border-primary pb-2 text-foreground"
              : "pb-2 text-muted-foreground hover:text-foreground"
          }
        >
          Divisions
        </Link>
      </nav>

      {currentView === "divisions" ? (
        <DivisionsTable
          divisions={divisions}
          isAdmin={isAdmin}
          activeLeagueId={leagueId}
          activeSeasonName={activeSeasonName}
          hasPlayedGames={hasPlayedGames}
          standingsHref={standingsHref}
          selectedDivisionId={selectedDivisionId}
        />
      ) : !hasActiveSeason ? (
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
          onQuickView={(teamId) => setSelectedTeamId(teamId)}
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

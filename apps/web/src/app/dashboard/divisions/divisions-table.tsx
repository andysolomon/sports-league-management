"use client";

import { useRouter } from "next/navigation";
import type { DivisionDto } from "@sports-management/shared-types";
import { DataTable, type Column } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Layers } from "lucide-react";
import {
  CreateDivisionButton,
  DivisionRowActions,
} from "../leagues/division-controls";

type DivisionWithLeague = DivisionDto & {
  leagueName: string;
  teamCount: number;
} & Record<string, unknown>;

const columns: Column<DivisionWithLeague>[] = [
  { key: "name", header: "Name", sortable: true },
  {
    key: "leagueName",
    header: "League",
    sortable: true,
    render: (d) => d.leagueName,
  },
  {
    key: "teamCount",
    header: "Teams",
    sortable: true,
    render: (d) => d.teamCount,
  },
];

interface DivisionsTableProps {
  divisions: DivisionWithLeague[];
  isAdmin: boolean;
  activeLeagueId: string | null;
}

export function DivisionsTable({
  divisions,
  isAdmin,
  activeLeagueId,
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
      {isAdmin && activeLeagueId ? (
        <div className="flex justify-end">
          <CreateDivisionButton leagueId={activeLeagueId} />
        </div>
      ) : null}
      <DataTable
        data={divisions}
        columns={columns}
        searchPlaceholder="Search divisions..."
        searchKeys={["name", "leagueName"]}
        onRowClick={(d) => router.push(`/dashboard/divisions/${d.id}`)}
        actions={
          isAdmin
            ? (d) => (
                <DivisionRowActions
                  divisionId={d.id}
                  currentName={d.name}
                  teamCount={d.teamCount}
                />
              )
            : undefined
        }
      />
    </div>
  );
}

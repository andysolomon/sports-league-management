"use client";

import type { DivisionDto } from "@sports-management/shared-types";
import { DataTable, type Column } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Layers } from "lucide-react";

type DivisionWithLeague = DivisionDto & { leagueName: string } & Record<string, unknown>;

const columns: Column<DivisionWithLeague>[] = [
  { key: "name", header: "Name", sortable: true },
  {
    key: "leagueName",
    header: "League",
    sortable: true,
    render: (d) => d.leagueName,
  },
];

interface DivisionsTableProps {
  divisions: DivisionWithLeague[];
}

export function DivisionsTable({ divisions }: DivisionsTableProps) {
  if (divisions.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No divisions found"
        description="Divisions will appear here once created in the system."
      />
    );
  }

  return (
    <DataTable
      data={divisions}
      columns={columns}
      searchPlaceholder="Search divisions..."
      searchKeys={["name", "leagueName"]}
    />
  );
}

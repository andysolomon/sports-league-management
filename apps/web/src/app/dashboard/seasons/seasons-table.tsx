"use client";

import type { SeasonDto } from "@sports-management/shared-types";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Calendar } from "lucide-react";
import { formatDate } from "@/lib/format";

const columns: Column<SeasonDto & Record<string, unknown>>[] = [
  { key: "name", header: "Name", sortable: true },
  {
    key: "startDate",
    header: "Start Date",
    sortable: true,
    render: (s) => formatDate(s.startDate),
  },
  {
    key: "endDate",
    header: "End Date",
    sortable: true,
    render: (s) => formatDate(s.endDate),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (s) => <StatusBadge status={s.status} />,
  },
];

interface SeasonsTableProps {
  seasons: SeasonDto[];
}

export function SeasonsTable({ seasons }: SeasonsTableProps) {
  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No seasons found"
        description="Seasons will appear here once created in the system."
      />
    );
  }

  return (
    <DataTable
      data={seasons as (SeasonDto & Record<string, unknown>)[]}
      columns={columns}
      searchPlaceholder="Search seasons..."
      searchKeys={["name", "status"]}
    />
  );
}

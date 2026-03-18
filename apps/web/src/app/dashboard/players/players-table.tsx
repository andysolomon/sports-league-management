"use client";

import type { PlayerDto } from "@sports-management/shared-types";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { UserCircle } from "lucide-react";

const columns: Column<PlayerDto & Record<string, unknown>>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "position", header: "Position", sortable: true },
  {
    key: "jerseyNumber",
    header: "Jersey #",
    sortable: true,
    render: (p) => p.jerseyNumber ?? "\u2014",
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (p) => <StatusBadge status={p.status} />,
  },
];

interface PlayersTableProps {
  players: PlayerDto[];
}

export function PlayersTable({ players }: PlayersTableProps) {
  if (players.length === 0) {
    return (
      <EmptyState
        icon={UserCircle}
        title="No players found"
        description="Players will appear here once teams add roster members."
      />
    );
  }

  return (
    <DataTable
      data={players as (PlayerDto & Record<string, unknown>)[]}
      columns={columns}
      searchPlaceholder="Search players..."
      searchKeys={["name", "position", "status"]}
    />
  );
}

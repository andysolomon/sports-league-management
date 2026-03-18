"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamDto, PlayerDto } from "@sports-management/shared-types";
import PlayerForm from "../../_components/player-form";
import TeamEditForm from "../../_components/team-edit-form";
import DeleteConfirm from "../../_components/delete-confirm";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TeamManagementProps {
  team: TeamDto;
  players: PlayerDto[];
  canManage: boolean;
}

type ModalState =
  | { type: "none" }
  | { type: "editTeam" }
  | { type: "addPlayer" }
  | { type: "editPlayer"; player: PlayerDto }
  | { type: "deletePlayer"; player: PlayerDto };

export default function TeamManagement({
  team,
  players,
  canManage,
}: TeamManagementProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [isDeleting, setIsDeleting] = useState(false);

  function handleSuccess() {
    setModal({ type: "none" });
    router.refresh();
  }

  async function handleDeletePlayer(playerId: string) {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete player");
      }
      toast.success("Player deleted successfully");
      handleSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete player";
      toast.error(message);
      setIsDeleting(false);
    }
  }

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

  return (
    <>
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ type: "editTeam" })}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit Team
              </Button>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {team.city && (
              <div>
                <dt className="font-medium text-gray-500">City</dt>
                <dd className="mt-1 text-gray-900">{team.city}</dd>
              </div>
            )}
            {team.stadium && (
              <div>
                <dt className="font-medium text-gray-500">Stadium</dt>
                <dd className="mt-1 text-gray-900">{team.stadium}</dd>
              </div>
            )}
            {team.foundedYear && (
              <div>
                <dt className="font-medium text-gray-500">Founded</dt>
                <dd className="mt-1 text-gray-900">{team.foundedYear}</dd>
              </div>
            )}
            {team.location && (
              <div>
                <dt className="font-medium text-gray-500">Location</dt>
                <dd className="mt-1 text-gray-900">{team.location}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Player Roster ({players.length})
        </h3>
        {canManage && (
          <Button onClick={() => setModal({ type: "addPlayer" })}>
            Add Player
          </Button>
        )}
      </div>

      {players.length > 0 ? (
        <DataTable
          data={players as (PlayerDto & Record<string, unknown>)[]}
          columns={columns}
          searchPlaceholder="Search players..."
          searchKeys={["name", "position", "status"]}
          actions={
            canManage
              ? (player) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setModal({
                          type: "editPlayer",
                          player: player as unknown as PlayerDto,
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() =>
                        setModal({
                          type: "deletePlayer",
                          player: player as unknown as PlayerDto,
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              : undefined
          }
        />
      ) : (
        <EmptyState
          icon={UserCircle}
          title="No players on this team"
          description="Add players to build the team roster."
          action={
            canManage ? (
              <Button onClick={() => setModal({ type: "addPlayer" })}>
                Add Player
              </Button>
            ) : undefined
          }
        />
      )}

      <TeamEditForm
        team={team}
        open={modal.type === "editTeam"}
        onOpenChange={(open) => !open && setModal({ type: "none" })}
        onSuccess={handleSuccess}
      />

      <PlayerForm
        mode="create"
        teamId={team.id}
        open={modal.type === "addPlayer"}
        onOpenChange={(open) => !open && setModal({ type: "none" })}
        onSuccess={handleSuccess}
      />

      {modal.type === "editPlayer" && (
        <PlayerForm
          mode="edit"
          teamId={team.id}
          player={modal.player}
          open
          onOpenChange={(open) => !open && setModal({ type: "none" })}
          onSuccess={handleSuccess}
        />
      )}

      {modal.type === "deletePlayer" && (
        <DeleteConfirm
          title="Delete Player"
          message={`Are you sure you want to delete ${modal.player.name}? This action cannot be undone.`}
          isOpen
          isDeleting={isDeleting}
          onConfirm={() => handleDeletePlayer(modal.player.id)}
          onCancel={() => setModal({ type: "none" })}
        />
      )}
    </>
  );
}

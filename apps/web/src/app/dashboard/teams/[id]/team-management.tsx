"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamDto, PlayerDto } from "@sports-management/shared-types";
import PlayerForm from "../../_components/player-form";
import TeamEditForm from "../../_components/team-edit-form";
import DeleteConfirm from "../../_components/delete-confirm";

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
      handleSuccess();
    } catch {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
          {canManage && (
            <button
              type="button"
              onClick={() => setModal({ type: "editTeam" })}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit Team
            </button>
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
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Player Roster ({players.length})
        </h3>
        {canManage && (
          <button
            type="button"
            onClick={() => setModal({ type: "addPlayer" })}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            Add Player
          </button>
        )}
      </div>

      {players.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Jersey #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                {canManage && (
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {players.map((player) => (
                <tr key={player.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {player.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {player.position}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {player.jerseyNumber ?? "\u2014"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {player.status}
                  </td>
                  {canManage && (
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <button
                        type="button"
                        onClick={() =>
                          setModal({ type: "editPlayer", player })
                        }
                        className="mr-2 text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModal({ type: "deletePlayer", player })
                        }
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No players on this team.</p>
      )}

      {modal.type === "editTeam" && (
        <TeamEditForm
          team={team}
          onSuccess={handleSuccess}
          onCancel={() => setModal({ type: "none" })}
        />
      )}

      {modal.type === "addPlayer" && (
        <PlayerForm
          mode="create"
          teamId={team.id}
          onSuccess={handleSuccess}
          onCancel={() => setModal({ type: "none" })}
        />
      )}

      {modal.type === "editPlayer" && (
        <PlayerForm
          mode="edit"
          teamId={team.id}
          player={modal.player}
          onSuccess={handleSuccess}
          onCancel={() => setModal({ type: "none" })}
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

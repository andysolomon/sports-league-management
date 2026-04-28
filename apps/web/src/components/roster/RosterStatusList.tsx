"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type {
  PlayerDto,
  RosterAssignmentDto,
} from "@sports-management/shared-types";
import { Button } from "@/components/ui/8bit/button";
import { updateRosterStatusAction } from "@/app/dashboard/teams/[id]/roster/actions";

export interface RosterStatusListProps {
  assignments: RosterAssignmentDto[];
  playersById: Map<string, PlayerDto>;
  teamId: string;
  seasonId: string;
  leagueId: string;
  disabled: boolean;
  onChanged: () => void;
}

export default function RosterStatusList({
  assignments,
  playersById,
  teamId,
  seasonId,
  leagueId,
  disabled,
  onChanged,
}: RosterStatusListProps) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No players in this status.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {assignments.map((assignment) => (
        <StatusRow
          key={assignment.id}
          assignment={assignment}
          player={playersById.get(assignment.playerId) ?? null}
          teamId={teamId}
          seasonId={seasonId}
          leagueId={leagueId}
          disabled={disabled}
          onChanged={onChanged}
        />
      ))}
    </ul>
  );
}

function StatusRow({
  assignment,
  player,
  teamId,
  seasonId,
  leagueId,
  disabled,
  onChanged,
}: {
  assignment: RosterAssignmentDto;
  player: PlayerDto | null;
  teamId: string;
  seasonId: string;
  leagueId: string;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function run(newStatus: "active" | "released") {
    startTransition(async () => {
      try {
        await updateRosterStatusAction({
          assignmentId: assignment.id,
          seasonId,
          teamId,
          leagueId,
          fromStatus: assignment.status,
          newStatus,
        });
        toast.success(
          newStatus === "active"
            ? "Reactivated on roster"
            : "Released from roster",
        );
        onChanged();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(mapStatusError(message));
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="font-mono text-xs uppercase text-muted-foreground">
        {assignment.positionSlot}
      </span>
      <span className="flex-1 text-sm text-foreground">
        {player?.name ?? <em>Unknown player</em>}
      </span>
      {player?.jerseyNumber != null ? (
        <span className="font-mono text-xs text-muted-foreground">
          #{player.jerseyNumber}
        </span>
      ) : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => run("active")}
          disabled={disabled || pending}
        >
          Reactivate
        </Button>
        {assignment.status !== "released" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run("released")}
            disabled={pending}
          >
            Release
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function mapStatusError(message: string): string {
  if (message.startsWith("roster_limit_exceeded"))
    return "Roster is full. Move a player to IR or Released before reactivating another.";
  if (message === "season_locked")
    return "Season is locked. Ask an admin to unlock it.";
  if (message === "invalid_status_transition")
    return "That status change is not allowed.";
  return message;
}

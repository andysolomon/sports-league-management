"use client";

import { useTransition } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import type {
  PlayerDto,
  RosterAssignmentDto,
} from "@sports-management/shared-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/8bit/dropdown-menu";
import {
  removePlayerFromRosterAction,
  updateRosterStatusAction,
} from "@/app/dashboard/teams/[id]/roster/actions";

export interface RosterSlotGroupProps {
  positionSlot: string;
  assignments: RosterAssignmentDto[];
  playersById: Map<string, PlayerDto>;
  teamId: string;
  seasonId: string;
  leagueId: string;
  disabled: boolean;
  onChanged: () => void;
}

const STATUS_OPTIONS: Array<{ value: "ir" | "suspended" | "released"; label: string }> = [
  { value: "ir", label: "Move to IR" },
  { value: "suspended", label: "Suspend" },
  { value: "released", label: "Release" },
];

export default function RosterSlotGroup({
  positionSlot,
  assignments,
  playersById,
  teamId,
  seasonId,
  leagueId,
  disabled,
  onChanged,
}: RosterSlotGroupProps) {
  return (
    <section
      className="rounded-md border bg-background"
      aria-label={`${positionSlot} roster`}
    >
      <header className="flex items-center justify-between border-b px-3 py-2">
        <h4 className="font-mono text-sm font-semibold text-foreground">
          {positionSlot}
        </h4>
        <span className="text-xs text-muted-foreground">
          {assignments.length}
        </span>
      </header>
      <ol className="divide-y">
        {assignments.map((assignment) => (
          <RosterRow
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
      </ol>
    </section>
  );
}

function RosterRow({
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

  function runStatus(newStatus: "ir" | "suspended" | "released") {
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
        toast.success(`Moved to ${newStatus === "ir" ? "IR" : newStatus}`);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function runRemove() {
    startTransition(async () => {
      try {
        await removePlayerFromRosterAction({
          assignmentId: assignment.id,
          seasonId,
          teamId,
          leagueId,
          positionSlot: assignment.positionSlot,
        });
        toast.success("Removed from roster");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="w-6 font-mono text-xs text-muted-foreground">
        {assignment.depthRank}
      </span>
      <span className="flex-1 text-sm text-foreground">
        {player?.name ?? <em>Unknown player</em>}
      </span>
      {player?.jerseyNumber != null ? (
        <span className="font-mono text-xs text-muted-foreground">
          #{player.jerseyNumber}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || pending}
          aria-label={`Actions for ${player?.name ?? "player"}`}
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STATUS_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => runStatus(opt.value)}
              disabled={pending}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={runRemove}
            disabled={pending}
            className="text-red-600"
          >
            Remove from roster
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

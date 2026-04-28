"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { PlayerDto } from "@sports-management/shared-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/8bit/dialog";
import { Button } from "@/components/ui/8bit/button";
import { Label } from "@/components/ui/8bit/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/8bit/select";
import { assignPlayerToRosterAction } from "@/app/dashboard/teams/[id]/roster/actions";

export interface AssignPlayerDialogProps {
  teamId: string;
  seasonId: string;
  leagueId: string;
  eligiblePlayers: PlayerDto[];
  onAssigned: () => void;
  disabled?: boolean;
}

export default function AssignPlayerDialog({
  teamId,
  seasonId,
  leagueId,
  eligiblePlayers,
  onAssigned,
  disabled,
}: AssignPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState<string>("");
  const [positionSlot, setPositionSlot] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const selectedPlayer = eligiblePlayers.find((p) => p.id === playerId) ?? null;
  const effectiveSlot = positionSlot || selectedPlayer?.position || "";

  function handleSubmit() {
    if (!playerId || !effectiveSlot) {
      toast.error("Pick a player and a position slot.");
      return;
    }
    startTransition(async () => {
      try {
        await assignPlayerToRosterAction({
          seasonId,
          teamId,
          leagueId,
          playerId,
          positionSlot: effectiveSlot,
        });
        toast.success("Player added to roster");
        setOpen(false);
        setPlayerId("");
        setPositionSlot("");
        onAssigned();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(mapAssignError(message));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>Add to Roster</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add player to roster</DialogTitle>
          <DialogDescription>
            Pick a player on this team and the depth-chart slot they belong to.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="roster-player">Player</Label>
            <Select
              value={playerId}
              onValueChange={(value) => {
                setPlayerId(value);
                const player = eligiblePlayers.find((p) => p.id === value);
                if (player) setPositionSlot(player.position);
              }}
            >
              <SelectTrigger id="roster-player">
                <SelectValue placeholder="Select a player" />
              </SelectTrigger>
              <SelectContent>
                {eligiblePlayers.length === 0 ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    No eligible players.
                  </div>
                ) : (
                  eligiblePlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.jerseyNumber !== null ? ` (#${p.jerseyNumber})` : ""}
                      {" — "}
                      {p.position}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="roster-slot">Position slot</Label>
            <input
              id="roster-slot"
              value={effectiveSlot}
              onChange={(e) => setPositionSlot(e.target.value.toUpperCase())}
              className="h-10 rounded-md border bg-background px-3 text-sm font-mono"
              placeholder="e.g. QB, WR1"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !playerId}>
            {pending ? "Adding…" : "Add to roster"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function mapAssignError(message: string): string {
  if (message.startsWith("roster_limit_exceeded"))
    return "Roster is full. Move a player to IR or Released before adding another.";
  if (message === "season_locked")
    return "Season is locked. Ask an admin to unlock it.";
  if (message === "player_already_on_roster")
    return "Player is already on the roster.";
  if (message === "player_not_on_team")
    return "Pick a player that belongs to this team.";
  return message;
}

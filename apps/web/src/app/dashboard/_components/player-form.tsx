"use client";

import { useState } from "react";
import type { PlayerDto } from "@sports-management/shared-types";
import {
  CreatePlayerInputSchema,
  UpdatePlayerInputSchema,
} from "@sports-management/api-contracts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/8bit/dialog";
import { Button } from "@/components/ui/8bit/button";
import { Input } from "@/components/ui/8bit/input";
import { Label } from "@/components/ui/8bit/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/8bit/select";
import { toast } from "sonner";

interface PlayerFormProps {
  mode: "create" | "edit";
  teamId: string;
  player?: PlayerDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function PlayerForm({
  mode,
  teamId,
  player,
  open,
  onOpenChange,
  onSuccess,
}: PlayerFormProps) {
  const [name, setName] = useState(player?.name ?? "");
  const [position, setPosition] = useState(player?.position ?? "");
  const [jerseyNumber, setJerseyNumber] = useState(
    player?.jerseyNumber?.toString() ?? "",
  );
  const [dateOfBirth, setDateOfBirth] = useState(player?.dateOfBirth ?? "");
  const [status, setStatus] = useState(player?.status ?? "Active");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const data = {
        name,
        teamId,
        position,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
        dateOfBirth: dateOfBirth || null,
        status,
      };

      if (mode === "create") {
        const parsed = CreatePlayerInputSchema.safeParse(data);
        if (!parsed.success) {
          setError(parsed.error.errors[0].message);
          return;
        }
        const res = await fetch("/api/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to create player");
        }
        toast.success("Player added successfully");
      } else {
        const parsed = UpdatePlayerInputSchema.safeParse(data);
        if (!parsed.success) {
          setError(parsed.error.errors[0].message);
          return;
        }
        const res = await fetch(`/api/players/${player!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to update player");
        }
        toast.success("Player updated successfully");
      }

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Player" : "Edit Player"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new player to the team roster."
              : "Update the player's information."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="player-name">Name *</Label>
            <Input
              id="player-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-position">Position *</Label>
            <Input
              id="player-position"
              type="text"
              required
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-jersey">Jersey Number</Label>
            <Input
              id="player-jersey"
              type="number"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-dob">Date of Birth</Label>
            <Input
              id="player-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-status">Status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="player-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Injured">Injured</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving..."
                : mode === "create"
                  ? "Add Player"
                  : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

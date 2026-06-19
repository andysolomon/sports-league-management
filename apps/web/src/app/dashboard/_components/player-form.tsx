"use client";

import { useState } from "react";
import type { PlayerDto } from "@sports-management/shared-types";
import {
  CreatePlayerInputSchema,
  UpdatePlayerInputSchema,
  SQUADS,
} from "@sports-management/api-contracts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Football position pick-list (WSM-000119). Common positions first, then the
// granular variants. ATH = athlete/unspecified.
const POSITION_OPTIONS = [
  "QB",
  "RB",
  "FB",
  "WR",
  "TE",
  "OL",
  "LT",
  "LG",
  "C",
  "RG",
  "RT",
  "DL",
  "DE",
  "DT",
  "NT",
  "EDGE",
  "LB",
  "OLB",
  "MLB",
  "ILB",
  "DB",
  "CB",
  "S",
  "FS",
  "SS",
  "K",
  "P",
  "LS",
  "ATH",
];

// Jersey numbers 0–99 (WSM-000125). Picker, not free text.
const JERSEY_OPTIONS = Array.from({ length: 100 }, (_, n) => n);

interface PlayerFormProps {
  mode: "create" | "edit";
  teamId: string;
  player?: PlayerDto;
  /** Jersey numbers already on the roster (excluding this player) — for the
      duplicate warning (WSM-000119). Duplicates are allowed (e.g. college). */
  existingJerseyNumbers?: number[];
  /** Team policy (WSM-000125): when false, a duplicate is blocked server-side,
      so the inline alert is an error rather than a soft warning. */
  allowDuplicateJerseys?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function PlayerForm({
  mode,
  teamId,
  player,
  existingJerseyNumbers = [],
  allowDuplicateJerseys = true,
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
  const [grade, setGrade] = useState(player?.grade?.toString() ?? "");
  const [squad, setSquad] = useState(player?.squad ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Duplicate jersey is allowed (e.g. college) but flagged (WSM-000119).
  const jerseyTaken =
    jerseyNumber !== "" &&
    existingJerseyNumbers.includes(Number(jerseyNumber));

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
        grade: grade ? Number(grade) : null,
        squad: squad || null,
      };

      // When duplicates are allowed, a clash is a soft warning (saved anyway).
      // When blocked, we still attempt the save — the server returns a 409 that
      // surfaces below — so we don't pre-empt with a misleading toast.
      if (jerseyTaken && allowDuplicateJerseys) {
        toast.warning(
          `#${jerseyNumber} is already used on this roster — saved anyway.`,
        );
      }

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
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger id="player-position">
                <SelectValue placeholder="Select a position" />
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-jersey">Jersey Number</Label>
            <Select
              value={jerseyNumber === "" ? "none" : jerseyNumber}
              onValueChange={(val) =>
                setJerseyNumber(val === "none" ? "" : val)
              }
            >
              <SelectTrigger id="player-jersey" aria-invalid={jerseyTaken}>
                <SelectValue placeholder="Select a number" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {JERSEY_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {jerseyTaken && (
              <p
                role="alert"
                className={
                  allowDuplicateJerseys
                    ? "text-xs text-yellow-600 dark:text-yellow-500"
                    : "text-xs text-destructive"
                }
              >
                {allowDuplicateJerseys
                  ? `#${jerseyNumber} is already on this roster — allowed, but it’s a duplicate.`
                  : `#${jerseyNumber} is already on this roster. This team blocks duplicate numbers — pick another.`}
              </p>
            )}
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

          <div className="space-y-2">
            <Label htmlFor="player-grade">Grade</Label>
            <Select
              value={grade === "" ? "none" : grade}
              onValueChange={(val) => setGrade(val === "none" ? "" : val)}
            >
              <SelectTrigger id="player-grade">
                <SelectValue placeholder="Select a grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {[9, 10, 11, 12].map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {g}th
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-squad">Squad</Label>
            <Select
              value={squad === "" ? "none" : squad}
              onValueChange={(val) => setSquad(val === "none" ? "" : val)}
            >
              <SelectTrigger id="player-squad">
                <SelectValue placeholder="Select a squad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {SQUADS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
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

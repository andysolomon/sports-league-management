"use client";

import { useState } from "react";
import type { TeamDto } from "@sports-management/shared-types";
import { UpdateTeamInputSchema } from "@sports-management/api-contracts";
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
import { toast } from "sonner";

interface TeamEditFormProps {
  team: TeamDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function TeamEditForm({
  team,
  open,
  onOpenChange,
  onSuccess,
}: TeamEditFormProps) {
  const [name, setName] = useState(team.name);
  const [city, setCity] = useState(team.city);
  const [stadium, setStadium] = useState(team.stadium);
  const [foundedYear, setFoundedYear] = useState(
    team.foundedYear?.toString() ?? "",
  );
  const [location, setLocation] = useState(team.location);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const data = {
        name,
        city,
        stadium,
        foundedYear: foundedYear ? Number(foundedYear) : null,
        location,
      };

      const parsed = UpdateTeamInputSchema.safeParse(data);
      if (!parsed.success) {
        setError(parsed.error.errors[0].message);
        return;
      }

      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update team");
      }

      toast.success("Team updated successfully");
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
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>
            Update the team&apos;s information.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-city">City</Label>
            <Input
              id="team-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-stadium">Stadium</Label>
            <Input
              id="team-stadium"
              type="text"
              value={stadium}
              onChange={(e) => setStadium(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-founded">Founded Year</Label>
            <Input
              id="team-founded"
              type="number"
              value={foundedYear}
              onChange={(e) => setFoundedYear(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-location">Location</Label>
            <Input
              id="team-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
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
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

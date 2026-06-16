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
  const [teamName, setTeamName] = useState(team.teamName ?? "");
  const [city, setCity] = useState(team.city);
  const [stadium, setStadium] = useState(team.stadium);
  const [foundedYear, setFoundedYear] = useState(
    team.foundedYear?.toString() ?? "",
  );
  const [location, setLocation] = useState(team.location);
  const [logoUrl, setLogoUrl] = useState(team.logoUrl ?? "");
  const [useColors, setUseColors] = useState(
    team.primaryColor != null || team.secondaryColor != null,
  );
  const [primaryColor, setPrimaryColor] = useState(
    team.primaryColor ?? "#1e293b",
  );
  const [secondaryColor, setSecondaryColor] = useState(
    team.secondaryColor ?? "#64748b",
  );
  const [allowDuplicateJerseys, setAllowDuplicateJerseys] = useState(
    team.allowDuplicateJerseys,
  );
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
        teamName: teamName.trim() || null,
        logoUrl: logoUrl.trim() || null,
        primaryColor: useColors ? primaryColor : null,
        secondaryColor: useColors ? secondaryColor : null,
        allowDuplicateJerseys,
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
      {/* DialogContent caps height + scrolls (base); the footer below is pinned
          (sticky) so Save is always reachable on a short mobile viewport. */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>
            Update the team&apos;s information.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">School / Organization name</Label>
            <Input
              id="team-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-teamname">Team name / mascot</Label>
            <Input
              id="team-teamname"
              type="text"
              value={teamName}
              placeholder="e.g. Buccaneers (optional)"
              onChange={(e) => setTeamName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown as &ldquo;{name || "School"}
              {teamName.trim() ? ` — ${teamName.trim()}` : ""}&rdquo;.
            </p>
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

          <div className="space-y-2">
            <Label htmlFor="team-logo">Logo URL</Label>
            <Input
              id="team-logo"
              type="url"
              inputMode="url"
              value={logoUrl}
              placeholder="https://… (optional)"
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={useColors}
                onChange={(e) => setUseColors(e.target.checked)}
              />
              Custom team colors
            </label>
            {useColors ? (
              <div className="flex flex-wrap gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="team-primary" className="text-xs">
                    Primary
                  </Label>
                  <input
                    id="team-primary"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-input bg-background"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="team-secondary" className="text-xs">
                    Secondary
                  </Label>
                  <input
                    id="team-secondary"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-input bg-background"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={allowDuplicateJerseys}
                onChange={(e) => setAllowDuplicateJerseys(e.target.checked)}
              />
              Allow duplicate jersey numbers
            </label>
            <p className="text-xs text-muted-foreground">
              {allowDuplicateJerseys
                ? "Players may share a number — duplicates are flagged but allowed."
                : "Saving a number already on the roster is blocked."}
            </p>
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-3 border-t border-border bg-background px-6 py-4">
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

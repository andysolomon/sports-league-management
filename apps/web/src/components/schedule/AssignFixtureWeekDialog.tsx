"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignFixtureWeekAction } from "@/app/dashboard/leagues/[id]/schedule/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidWeek } from "@/lib/schedule/schedule-conflicts";

export default function AssignFixtureWeekDialog({
  leagueId,
  fixtureId,
  homeTeamName,
  awayTeamName,
}: {
  leagueId: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const [open, setOpen] = useState(false);
  const [week, setWeek] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setWeek("");
      setError(null);
    }
  }

  function handleSubmit() {
    const weekNumber = Number(week);
    if (week.trim() === "" || !isValidWeek(weekNumber)) {
      setError("Enter a positive whole-number week.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await assignFixtureWeekAction({
        leagueId,
        fixtureId,
        week: weekNumber,
      });
      if (result.ok) {
        toast.success(`Fixture assigned to Week ${weekNumber}.`);
        handleOpenChange(false);
      } else {
        setError(mapError(result.error));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Assign week
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign week</DialogTitle>
          <DialogDescription>
            Schedule {awayTeamName} at {homeTeamName} into a numbered week.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor={`assign-week-${fixtureId}`}>Week</Label>
          <Input
            id={`assign-week-${fixtureId}`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            placeholder="1"
            value={week}
            aria-invalid={error !== null}
            aria-describedby={error ? `assign-week-error-${fixtureId}` : undefined}
            onChange={(event) => {
              setWeek(event.target.value);
              setError(null);
            }}
          />
          {error ? (
            <p
              id={`assign-week-error-${fixtureId}`}
              className="text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? "Assigning…" : "Assign week"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function mapError(code: string): string {
  switch (code) {
    case "week_required":
      return "Enter a positive whole-number week.";
    case "team_already_scheduled_that_week":
      return "One of these teams already has a game that week.";
    case "fixture_not_found":
      return "Fixture not found.";
    case "season_completed":
      return "Completed seasons cannot be changed.";
    case "season_league_mismatch":
    case "league_not_found":
    case "league_not_owned":
      return "League access denied.";
    case "unauthorized":
      return "Sign in required.";
    case "not_authorized":
      return "You do not have permission to edit this schedule.";
    default:
      return code;
  }
}

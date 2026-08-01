"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFixtureAction } from "@/app/dashboard/leagues/[id]/schedule/actions";
import { isValidWeek } from "@/lib/schedule/schedule-conflicts";

export interface FixtureFormDialogProps {
  leagueId: string;
  seasonId: string;
  /** All teams in this league. */
  teams: Array<{ id: string; name: string }>;
}

export default function FixtureFormDialog({
  leagueId,
  seasonId,
  teams,
}: FixtureFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState<string>("");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [week, setWeek] = useState<string>("");
  const [weekError, setWeekError] = useState<string | null>(null);
  const [venue, setVenue] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setHomeTeamId("");
    setAwayTeamId("");
    setScheduledAt("");
    setWeek("");
    setWeekError(null);
    setVenue("");
  }

  function handleSubmit() {
    if (!homeTeamId || !awayTeamId) {
      toast.error("Pick both teams.");
      return;
    }
    if (homeTeamId === awayTeamId) {
      toast.error("Home and away must differ.");
      return;
    }

    const weekNum = Number(week);
    if (week.trim() === "" || !isValidWeek(weekNum)) {
      setWeekError("Enter a positive whole-number week.");
      return;
    }
    setWeekError(null);

    startTransition(async () => {
      const result = await createFixtureAction({
        leagueId,
        seasonId,
        homeTeamId,
        awayTeamId,
        scheduledAt: scheduledAt.trim() === "" ? null : scheduledAt,
        week: weekNum,
        venue: venue.trim() === "" ? null : venue,
      });
      if (result.ok) {
        toast.success("Fixture created.");
        setOpen(false);
        reset();
      } else {
        toast.error(mapError(result.error));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New fixture</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New fixture</DialogTitle>
          <DialogDescription>
            Schedule a single game between two teams in this season.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="fix-home">Home team</Label>
            <Select value={homeTeamId} onValueChange={setHomeTeamId}>
              <SelectTrigger id="fix-home">
                <SelectValue placeholder="Select home team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fix-away">Away team</Label>
            <Select value={awayTeamId} onValueChange={setAwayTeamId}>
              <SelectTrigger id="fix-away">
                <SelectValue placeholder="Select away team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fix-week">Week</Label>
              <Input
                id="fix-week"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                placeholder="1"
                value={week}
                aria-invalid={weekError !== null}
                aria-describedby={weekError ? "fix-week-error" : undefined}
                onChange={(e) => {
                  setWeek(e.target.value);
                  setWeekError(null);
                }}
              />
              {weekError ? (
                <p id="fix-week-error" className="text-sm text-destructive">
                  {weekError}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fix-date">Date / time</Label>
              <Input
                id="fix-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fix-venue">Venue</Label>
            <Input
              id="fix-venue"
              placeholder="(optional)"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Creating…" : "Create fixture"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function mapError(code: string): string {
  switch (code) {
    case "flag_disabled":
      return "Schedules feature is disabled.";
    case "unauthorized":
      return "Sign in required.";
    case "league_not_found":
      return "League not found in your visible leagues.";
    case "league_not_owned":
      return "League access denied.";
    case "not_admin":
      return "Only org admins can create fixtures.";
    case "home_and_away_must_differ":
      return "Home and away teams must differ.";
    case "season_not_found":
      return "Season not found.";
    case "team_not_found":
      return "Team not found.";
    case "teams_outside_league":
      return "Both teams must belong to this league.";
    case "week_required":
      return "Enter a positive whole-number week.";
    case "team_already_scheduled_that_week":
      return "One of those teams already has a game that week.";
    default:
      return code;
  }
}

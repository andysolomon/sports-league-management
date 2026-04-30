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
} from "@/components/ui/8bit/dialog";
import { Button } from "@/components/ui/8bit/button";
import { Label } from "@/components/ui/8bit/label";
import { Input } from "@/components/ui/8bit/input";
import { recordGameResultAction } from "@/app/dashboard/leagues/[id]/schedule/actions";

export interface RecordResultDialogProps {
  leagueId: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  /** Pre-fill from existing result if one was already recorded. */
  initialHomeScore: number | null;
  initialAwayScore: number | null;
  /** Trigger label — different copy when a result already exists. */
  triggerLabel: string;
}

export default function RecordResultDialog({
  leagueId,
  fixtureId,
  homeTeamName,
  awayTeamName,
  initialHomeScore,
  initialAwayScore,
  triggerLabel,
}: RecordResultDialogProps) {
  const [open, setOpen] = useState(false);
  const [homeScore, setHomeScore] = useState<string>(
    initialHomeScore === null ? "" : String(initialHomeScore),
  );
  const [awayScore, setAwayScore] = useState<string>(
    initialAwayScore === null ? "" : String(initialAwayScore),
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const home = Number(homeScore);
    const away = Number(awayScore);
    if (
      !Number.isFinite(home) ||
      !Number.isFinite(away) ||
      home < 0 ||
      away < 0
    ) {
      toast.error("Scores must be non-negative numbers.");
      return;
    }
    startTransition(async () => {
      const result = await recordGameResultAction({
        leagueId,
        fixtureId,
        homeScore: home,
        awayScore: away,
      });
      if (result.ok) {
        toast.success("Result recorded.");
        setOpen(false);
      } else {
        toast.error(mapError(result.error));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record game result</DialogTitle>
          <DialogDescription>
            {homeTeamName} vs {awayTeamName}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="res-home">{homeTeamName} (home)</Label>
            <Input
              id="res-home"
              inputMode="numeric"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="res-away">{awayTeamName} (away)</Label>
            <Input
              id="res-away"
              inputMode="numeric"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
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
            {pending ? "Saving…" : "Save result"}
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
      return "League not found.";
    case "league_not_owned":
      return "League access denied.";
    case "not_admin":
      return "Only org admins can record results.";
    case "invalid_score":
      return "Scores must be non-negative numbers.";
    case "fixture_not_found":
      return "Fixture not found.";
    default:
      return code;
  }
}

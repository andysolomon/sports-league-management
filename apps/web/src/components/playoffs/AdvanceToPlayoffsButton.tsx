"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import { advanceToPlayoffsAction } from "@/app/dashboard/leagues/[id]/playoffs/actions";

export interface AdvanceToPlayoffsButtonProps {
  leagueId: string;
  /**
   * The season being advanced (WSM-000239). Sent explicitly so the server can
   * verify it is still the lifecycle-decided, non-completed season — a stale
   * tab viewing an old season can never advance the wrong one.
   */
  seasonId: string;
  disabled?: boolean;
  /** Button label — the schedule page hands off with "Start playoffs". */
  triggerLabel?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  regular_season_incomplete:
    "Finish every regular-season game before advancing.",
  already_advanced: "Playoffs have already started for this season.",
  no_season: "No active season found.",
  invalid_playoff_team_count:
    "Playoff team count must be 4, 8, or 16 for this season.",
  season_required: "No season selected — reload and try again.",
  season_not_found: "This season no longer exists.",
  season_completed: "This season is already completed.",
  season_mismatch:
    "This is not the league's current season — switch to the active season to start playoffs.",
};

export default function AdvanceToPlayoffsButton({
  leagueId,
  seasonId,
  disabled = false,
  triggerLabel = "Advance to playoffs",
}: AdvanceToPlayoffsButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onConfirm() {
    startTransition(async () => {
      const res = await advanceToPlayoffsAction({ leagueId, seasonId });
      if (res.ok) {
        toast.success(
          `Playoffs started — ${res.matchups} matchups across ${res.rounds} rounds.`,
        );
        router.refresh();
        setConfirmOpen(false);
        return;
      }

      toast.error(ERROR_MESSAGES[res.error] ?? res.error);
    });
  }

  return (
    <>
      <Button
        size="sm"
        disabled={disabled || pending}
        onClick={() => setConfirmOpen(true)}
        className="gap-1.5"
      >
        <Trophy className="h-4 w-4" />
        {pending ? "Advancing…" : triggerLabel}
      </Button>
      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Advance to playoffs?"
        description="A bracket will be seeded from the current standings and first-round games will be scheduled."
        confirmLabel="Advance"
        pending={pending}
        onConfirm={onConfirm}
      />
    </>
  );
}

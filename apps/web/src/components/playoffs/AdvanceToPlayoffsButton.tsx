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
  disabled?: boolean;
}

export default function AdvanceToPlayoffsButton({
  leagueId,
  disabled = false,
}: AdvanceToPlayoffsButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onConfirm() {
    startTransition(async () => {
      const res = await advanceToPlayoffsAction({ leagueId });
      if (res.ok) {
        toast.success(
          `Playoffs started — ${res.matchups} matchups across ${res.rounds} rounds.`,
        );
        router.refresh();
        setConfirmOpen(false);
        return;
      }

      const message =
        res.error === "regular_season_incomplete"
          ? "Finish every regular-season game before advancing."
          : res.error === "already_advanced"
            ? "Playoffs have already started for this season."
            : res.error === "no_season"
              ? "No active season found."
              : res.error === "no_playoffs_configured"
                ? "This season is not configured for playoffs."
                : res.error;
      toast.error(message);
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
        {pending ? "Advancing…" : "Advance to playoffs"}
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

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { advanceOffseasonPhaseAction } from "@/app/dashboard/_actions/offseason-phases";
import {
  OFFSEASON_PHASE_LABELS,
  nextPhase,
  phaseGate,
  type DraftPhaseStatus,
  type OffseasonState,
} from "@/lib/dynasty/offseason-phases";
import { OffseasonPhaseStepper } from "./OffseasonPhaseStepper";

const REASON_COPY: Record<string, string> = {
  draft_in_progress:
    "Finish or end the draft before leaving the draft phase.",
  phase_busy:
    "Another admin advanced this offseason first. Reload to see where it is now.",
  phase_regression: "The offseason cannot move backwards.",
  phase_out_of_order: "Phases have to be completed in order.",
  not_authorized: "You do not have permission to advance the offseason.",
  season_not_upcoming: "This season has already started.",
};

function copyFor(reason: string): string {
  return REASON_COPY[reason] ?? "Could not advance the offseason.";
}

export interface OffseasonPhaseControlsProps {
  leagueId: string;
  seasonId: string;
  state: OffseasonState;
  draftStatus: DraftPhaseStatus;
  isAdmin: boolean;
  teamCount: number;
}

export function OffseasonPhaseControls({
  leagueId,
  seasonId,
  state,
  draftStatus,
  isAdmin,
  teamCount,
}: OffseasonPhaseControlsProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const target = nextPhase(state.phase);
  /*
   * The SAME gate the mutation runs (`phaseGate` is shared through
   * `convex/lib/offseasonPhases.ts`). Deciding here whether the button is
   * enabled and there whether the advance commits keeps the two answers from
   * drifting into a button that is clickable and an action that always fails.
   */
  const decision = target
    ? phaseGate({ from: state.phase, to: target, draftStatus })
    : null;
  const blockedReason =
    decision && !decision.ok ? decision.reason : null;

  function advance() {
    if (!target) return;
    setMessage(null);
    startTransition(async () => {
      const result = await advanceOffseasonPhaseAction({
        leagueId,
        seasonId,
        expectedPhase: state.phase,
        to: target,
      });
      if (!result.ok) {
        setMessage(copyFor(result.error));
        return;
      }
      setMessage(
        result.changed
          ? `Advanced to ${OFFSEASON_PHASE_LABELS[target]}.`
          : `Already in ${OFFSEASON_PHASE_LABELS[target]}.`,
      );
    });
  }

  return (
    <div className="space-y-5" data-testid="offseason-phase-controls">
      <OffseasonPhaseStepper state={state} />

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" data-testid="offseason-phase-summary">
          {teamCount} team{teamCount === 1 ? "" : "s"} in this offseason ·
          currently in {OFFSEASON_PHASE_LABELS[state.phase]}.
        </p>

        {isAdmin && target && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={pending || blockedReason !== null}
            data-testid="offseason-advance"
            onClick={advance}
          >
            Advance to {OFFSEASON_PHASE_LABELS[target]}
          </Button>
        )}
      </div>

      {blockedReason && (
        <p className="text-sm text-muted-foreground" data-testid="offseason-phase-blocked">
          {copyFor(blockedReason)}
        </p>
      )}

      {message && (
        <p className="text-sm text-foreground" data-testid="offseason-phase-message">
          {message}
        </p>
      )}
    </div>
  );
}

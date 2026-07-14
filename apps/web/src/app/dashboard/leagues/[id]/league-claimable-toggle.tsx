"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setLeagueClaimableAction } from "./actions";

export interface LeagueClaimableToggleProps {
  leagueId: string;
  /** Initial claimable value from the server. */
  initialClaimable: boolean;
  /** Whether the league is currently public — claiming needs both. */
  isPublic: boolean;
}

export default function LeagueClaimableToggle({
  leagueId,
  initialClaimable,
  isPublic,
}: LeagueClaimableToggleProps) {
  const [claimable, setClaimable] = useState(initialClaimable);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !claimable;
    startTransition(async () => {
      const result = await setLeagueClaimableAction(leagueId, next);
      if (result.ok) {
        setClaimable(next);
        toast.success(
          next
            ? "Teams in this league are now claimable by coaches."
            : "Teams are no longer claimable.",
        );
      } else {
        toast.error(`Failed to update claimable: ${result.error}`);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-label-14 text-foreground">Claimable by coaches</p>
        <p className="text-caption-12 text-text-muted">
          When on, a coach can find a team in this public template league and
          claim it — forking a private, editable copy for their org (WSM-000109).
          Use for curated leagues like GHSA.
        </p>
        <p className="mt-1 font-mono text-caption-12 text-text-subtle">
          Currently: {claimable ? "CLAIMABLE" : "NOT CLAIMABLE"}
        </p>
        {claimable && !isPublic && (
          <p
            className="mt-1 text-caption-12 text-yellow-600 dark:text-yellow-500"
            role="alert"
          >
            Claiming only works while the league is also public — set Visibility
            to public above for coaches to claim.
          </p>
        )}
      </div>
      <Button
        size="sm"
        className="shrink-0"
        variant={claimable ? "destructive" : "default"}
        onClick={handleToggle}
        disabled={pending}
      >
        {pending ? "Saving…" : claimable ? "Disable claiming" : "Enable claiming"}
      </Button>
    </div>
  );
}

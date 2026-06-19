"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateScheduleAction } from "@/app/dashboard/leagues/[id]/schedule/actions";

export interface GenerateScheduleButtonProps {
  leagueId: string;
  seasonId: string;
  seasonName: string;
  /** Whether the season already has fixtures (changes the button label). */
  hasFixtures: boolean;
}

function friendlyError(code: string): string {
  if (code.includes("need_at_least_two_teams")) {
    return "Add at least two teams to this league before generating a schedule.";
  }
  if (code.includes("season_not_found")) {
    return "This season no longer exists.";
  }
  return "Could not generate the schedule.";
}

export default function GenerateScheduleButton({
  leagueId,
  seasonId,
  seasonName,
  hasFixtures,
}: GenerateScheduleButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(confirm: boolean) {
    startTransition(async () => {
      const res = await generateScheduleAction({ leagueId, seasonId, confirm });

      if (res.ok) {
        toast.success(
          `Generated ${res.created} games across ${res.weeks} weeks for ${res.teamCount} teams.`,
        );
        router.refresh();
        return;
      }

      if ("needsConfirm" in res) {
        const proceed = window.confirm(
          `${seasonName} already has games with recorded results or a live game. Regenerating deletes the entire schedule and those results. This can't be undone. Continue?`,
        );
        if (proceed) run(true);
        return;
      }

      toast.error(friendlyError(res.error));
    });
  }

  function onClick() {
    // Plain re-runs (no results yet) still wipe the current slate; confirm
    // first so a stray click can't blow away manually-entered fixtures.
    if (
      hasFixtures &&
      !window.confirm(
        `Replace the current schedule for ${seasonName} with a fresh round-robin? Existing fixtures will be removed.`,
      )
    ) {
      return;
    }
    run(false);
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={onClick}>
      <CalendarPlus className="mr-1.5 h-4 w-4" />
      {pending
        ? "Generating…"
        : hasFixtures
          ? "Regenerate schedule"
          : "Generate schedule"}
    </Button>
  );
}

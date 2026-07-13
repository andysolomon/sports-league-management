"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import { ProcessDialog } from "@/components/lifecycle/ProcessDialog";
import { generateScheduleAction } from "@/app/dashboard/leagues/[id]/schedule/actions";
import { scheduleProcessStages } from "@/lib/process-stages";

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

type ScheduleFormat = "single" | "double";
type ConfirmStep = "replace" | "destructive" | null;

export default function GenerateScheduleButton({
  leagueId,
  seasonId,
  seasonName,
  hasFixtures,
}: GenerateScheduleButtonProps) {
  const router = useRouter();
  const formatId = useId();
  const [format, setFormat] = useState<ScheduleFormat>("single");
  const [pending, startTransition] = useTransition();
  const [confirmStep, setConfirmStep] = useState<ConfirmStep>(null);
  const [processOpen, setProcessOpen] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [stages, setStages] = useState(scheduleProcessStages("pending"));

  function beginProcess() {
    setConfirmStep(null);
    setProcessOpen(true);
    setProcessError(null);
    setStages(scheduleProcessStages("pending"));
  }

  function run(confirm: boolean) {
    beginProcess();
    startTransition(async () => {
      const res = await generateScheduleAction({
        leagueId,
        seasonId,
        confirm,
        format,
      });

      if (res.ok) {
        setStages(
          scheduleProcessStages("success", {
            created: res.created,
            weeks: res.weeks,
            teamCount: res.teamCount,
          }),
        );
        router.refresh();
        return;
      }

      if ("needsConfirm" in res) {
        setProcessOpen(false);
        setConfirmStep("destructive");
        return;
      }

      setStages(scheduleProcessStages("error"));
      setProcessError(friendlyError(res.error));
    });
  }

  function onClick() {
    if (hasFixtures) {
      setConfirmStep("replace");
      return;
    }
    run(false);
  }

  function handleConfirm() {
    if (confirmStep === "replace") {
      run(false);
      return;
    }
    if (confirmStep === "destructive") {
      run(true);
    }
  }

  function retryProcess() {
    run(confirmStep === "destructive");
  }

  const confirmCopy =
    confirmStep === "replace"
      ? {
          title: `Replace schedule for ${seasonName}?`,
          description: `Replace the current schedule for ${seasonName} with a fresh round-robin? Existing fixtures will be removed.`,
        }
      : confirmStep === "destructive"
        ? {
            title: "Regenerate schedule with existing results?",
            description: `${seasonName} already has games with recorded results or a live game. Regenerating deletes the entire schedule and those results. This can't be undone. Continue?`,
          }
        : null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={formatId} className="sr-only">
        Schedule format
      </label>
      <select
        id={formatId}
        value={format}
        disabled={pending}
        onChange={(e) => setFormat(e.target.value as ScheduleFormat)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="single">Single round-robin</option>
        <option value="double">Double (home &amp; away)</option>
      </select>
      <Button size="sm" variant="outline" disabled={pending} onClick={onClick}>
        <CalendarPlus className="mr-1.5 h-4 w-4" />
        {pending
          ? "Generating…"
          : hasFixtures
            ? "Regenerate schedule"
            : "Generate schedule"}
      </Button>
      {confirmCopy ? (
        <ActionConfirmDialog
          open={confirmStep !== null}
          onOpenChange={(open) => {
            if (!open && !pending) setConfirmStep(null);
          }}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmStep === "destructive" ? "Continue" : "Replace"}
          destructive={confirmStep === "destructive"}
          pending={pending}
          onConfirm={handleConfirm}
        />
      ) : null}
      <ProcessDialog
        open={processOpen}
        onOpenChange={setProcessOpen}
        title="Generate schedule"
        description={`Building the ${format === "double" ? "home-and-away" : "round-robin"} schedule for ${seasonName}.`}
        stages={stages}
        pending={pending}
        error={processError}
        onRetry={retryProcess}
      />
    </div>
  );
}

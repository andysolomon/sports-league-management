"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import { generatePlayoffsAction } from "@/app/dashboard/leagues/[id]/playoffs/actions";

export interface GeneratePlayoffsButtonProps {
  leagueId: string;
  seasonId: string;
  seasonName: string;
  /** Whether a bracket already exists (changes the button label + confirm copy). */
  hasBracket: boolean;
  /** Season's configured playoff team count — the default dropdown selection. */
  defaultSize?: number | null;
  /** Season's configured playoff format ("single" | "double"). */
  defaultFormat?: string | null;
}

// Bye-friendly counts (any value ≥ 2 is valid server-side; bracket rounds up to
// the next power of two and gives top seeds first-round byes).
const SIZES = [2, 4, 6, 8, 10, 12, 16] as const;

type ConfirmStep = "replace" | "destructive" | null;

export default function GeneratePlayoffsButton({
  leagueId,
  seasonId,
  seasonName,
  hasBracket,
  defaultSize,
  defaultFormat,
}: GeneratePlayoffsButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmStep, setConfirmStep] = useState<ConfirmStep>(null);
  // Default to the season's configured team count (fall back to 8). If the
  // configured count is not one of the offered options, it is still added below.
  const initialSize = defaultSize && defaultSize >= 2 ? defaultSize : 8;
  const [size, setSize] = useState<number>(initialSize);
  const [format, setFormat] = useState<string>(
    defaultFormat === "double" ? "double" : "single",
  );

  const sizeOptions = SIZES.includes(initialSize as (typeof SIZES)[number])
    ? [...SIZES]
    : [...SIZES, initialSize].sort((a, b) => a - b);

  function run(confirm: boolean) {
    startTransition(async () => {
      const res = await generatePlayoffsAction({
        leagueId,
        seasonId,
        size,
        format,
        confirm,
      });

      if (res.ok) {
        toast.success(
          `Generated a ${size}-team ${
            format === "double" ? "double" : "single"
          }-elim bracket (${res.rounds} rounds).`,
        );
        router.refresh();
        setConfirmStep(null);
        return;
      }

      if ("needsConfirm" in res) {
        setConfirmStep("destructive");
        return;
      }

      toast.error(res.error);
    });
  }

  function onClick() {
    if (hasBracket) {
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

  const confirmCopy =
    confirmStep === "replace"
      ? {
          title: `Replace bracket for ${seasonName}?`,
          description: `Replace the current bracket for ${seasonName} with a fresh ${size}-team bracket? Existing playoff games will be removed.`,
        }
      : confirmStep === "destructive"
        ? {
            title: "Regenerate bracket with existing results?",
            description: `${seasonName} already has a bracket with recorded results or a live game. Regenerating deletes the bracket and those results. This can't be undone. Continue?`,
          }
        : null;

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="bracket-size">
        Bracket size
      </label>
      <select
        id="bracket-size"
        value={size}
        disabled={pending}
        onChange={(e) => setSize(Number(e.target.value))}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {sizeOptions.map((s) => (
          <option key={s} value={s}>
            {s} teams
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="bracket-format">
        Bracket format
      </label>
      <select
        id="bracket-format"
        value={format}
        disabled={pending}
        onChange={(e) => setFormat(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="single">Single elim</option>
        <option value="double">Double elim</option>
      </select>
      <Button size="sm" variant="outline" disabled={pending} onClick={onClick}>
        <Trophy className="mr-1.5 h-4 w-4" />
        {pending
          ? "Generating…"
          : hasBracket
            ? "Regenerate bracket"
            : "Generate bracket"}
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
    </div>
  );
}

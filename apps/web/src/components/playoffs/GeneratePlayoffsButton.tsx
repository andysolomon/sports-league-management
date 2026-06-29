"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        return;
      }

      if ("needsConfirm" in res) {
        const proceed = window.confirm(
          `${seasonName} already has a bracket with recorded results or a live game. Regenerating deletes the bracket and those results. This can't be undone. Continue?`,
        );
        if (proceed) run(true);
        return;
      }

      toast.error(res.error);
    });
  }

  function onClick() {
    if (
      hasBracket &&
      !window.confirm(
        `Replace the current bracket for ${seasonName} with a fresh ${size}-team bracket? Existing playoff games will be removed.`,
      )
    ) {
      return;
    }
    run(false);
  }

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
    </div>
  );
}

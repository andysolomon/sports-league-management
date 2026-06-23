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
}

const SIZES = [4, 8, 16] as const;

export default function GeneratePlayoffsButton({
  leagueId,
  seasonId,
  seasonName,
  hasBracket,
}: GeneratePlayoffsButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [size, setSize] = useState<number>(8);

  function run(confirm: boolean) {
    startTransition(async () => {
      const res = await generatePlayoffsAction({
        leagueId,
        seasonId,
        size,
        confirm,
      });

      if (res.ok) {
        toast.success(`Generated a ${res.size}-team bracket (${res.rounds} rounds).`);
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
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {s} teams
          </option>
        ))}
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

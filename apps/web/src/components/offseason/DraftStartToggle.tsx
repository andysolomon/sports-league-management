"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { startDraftAction } from "@/app/dashboard/_actions/draft";
import { Button } from "@/components/ui/button";

export interface DraftStartToggleProps {
  leagueId: string;
  seasonId: string;
}

export function DraftStartToggle({ leagueId, seasonId }: DraftStartToggleProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleStartDraft() {
    start(async () => {
      const res = await startDraftAction({ leagueId, seasonId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Draft started.");
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-control border border-border bg-muted/30 p-4"
      data-testid="draft-start-toggle"
      aria-labelledby="draft-start-heading"
    >
      <h3
        id="draft-start-heading"
        className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground"
      >
        <ClipboardList className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        Offseason draft
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Run a snake draft from the free-agent pool, or skip and sign players
        through free agency only.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={handleStartDraft}
          aria-label="Start draft"
        >
          {pending ? "Starting…" : "Start draft"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Free agency remains available below.
        </span>
      </div>
    </section>
  );
}

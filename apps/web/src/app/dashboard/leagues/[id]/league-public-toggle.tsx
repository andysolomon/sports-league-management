"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setLeaguePublicAction } from "./actions";

export interface LeaguePublicToggleProps {
  leagueId: string;
  /** Initial isPublic value from the server. */
  initialIsPublic: boolean;
}

export default function LeaguePublicToggle({
  leagueId,
  initialIsPublic,
}: LeaguePublicToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !isPublic;
    startTransition(async () => {
      const result = await setLeaguePublicAction(leagueId, next);
      if (result.ok) {
        setIsPublic(next);
        toast.success(next ? "League is now public." : "League is private.");
      } else {
        toast.error(`Failed to update visibility: ${result.error}`);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-label-14 text-foreground">Visibility</p>
        <p className="text-caption-12 text-text-muted">
          Public leagues appear in Discover. When public, anyone can view
          player development charts at{" "}
          <code className="break-all font-mono">/leagues/{leagueId}/...</code>
        </p>
        <p className="mt-1 font-mono text-caption-12 text-text-subtle">
          Currently: {isPublic ? "PUBLIC" : "PRIVATE"}
        </p>
      </div>
      <Button
        size="sm"
        className="shrink-0"
        variant={isPublic ? "destructive" : "default"}
        onClick={handleToggle}
        disabled={pending}
      >
        {pending ? "Saving…" : isPublic ? "Make private" : "Make public"}
      </Button>
    </div>
  );
}

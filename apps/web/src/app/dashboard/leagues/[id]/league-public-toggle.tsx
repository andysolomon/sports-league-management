"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/8bit/button";
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
    <div className="flex flex-col gap-2 border-2 border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Public viewer
          </p>
          <p className="text-xs text-muted-foreground">
            When on, anyone can view player development charts at{" "}
            <code className="font-mono">/leagues/{leagueId}/...</code>
          </p>
        </div>
        <Button
          variant={isPublic ? "destructive" : "default"}
          onClick={handleToggle}
          disabled={pending}
        >
          {pending ? "Saving…" : isPublic ? "Make private" : "Make public"}
        </Button>
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        Currently: {isPublic ? "PUBLIC" : "PRIVATE"}
      </p>
    </div>
  );
}

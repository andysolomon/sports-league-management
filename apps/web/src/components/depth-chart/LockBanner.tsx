"use client";

import { useState, useTransition } from "react";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setRosterLockedAction } from "@/app/dashboard/teams/[id]/depth-chart/actions";

interface LockBannerProps {
  seasonId: string;
  leagueId: string;
  rosterLocked: boolean;
  isAdmin: boolean;
  onToggle: (locked: boolean) => void;
}

export default function LockBanner({
  seasonId,
  leagueId,
  rosterLocked,
  isAdmin,
  onToggle,
}: LockBannerProps) {
  const [pending, startTransition] = useTransition();
  const [optimisticLocked, setOptimisticLocked] = useState(rosterLocked);

  function handleToggle() {
    const next = !optimisticLocked;
    setOptimisticLocked(next);
    startTransition(async () => {
      try {
        const result = await setRosterLockedAction({
          seasonId,
          leagueId,
          locked: next,
        });
        onToggle(result.rosterLocked);
        toast.success(
          result.rosterLocked ? "Roster locked" : "Roster unlocked",
        );
      } catch (err) {
        setOptimisticLocked(!next);
        const message =
          err instanceof Error ? err.message : "Failed to toggle lock";
        toast.error(message);
      }
    });
  }

  if (!isAdmin && !optimisticLocked) return null;

  return (
    <div
      className={`mb-4 flex items-center justify-between rounded-md border p-3 ${
        optimisticLocked
          ? "border-amber-300 bg-amber-50"
          : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2 text-sm">
        {optimisticLocked ? (
          <Lock className="h-4 w-4 text-amber-600" aria-hidden />
        ) : (
          <Unlock className="h-4 w-4 text-gray-500" aria-hidden />
        )}
        <span className={optimisticLocked ? "text-amber-800" : "text-gray-700"}>
          {optimisticLocked
            ? "Roster locked — drag handles are disabled"
            : "Roster is unlocked"}
        </span>
      </div>
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={handleToggle}
        >
          {optimisticLocked ? "Unlock" : "Lock"} roster
        </Button>
      )}
    </div>
  );
}

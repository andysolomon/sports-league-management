"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteFixtureAction } from "@/app/dashboard/leagues/[id]/schedule/actions";

export interface DeleteFixtureButtonProps {
  leagueId: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
}

export default function DeleteFixtureButton({
  leagueId,
  fixtureId,
  homeTeamName,
  awayTeamName,
}: DeleteFixtureButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (
      !window.confirm(
        `Delete ${homeTeamName} vs ${awayTeamName}? Any recorded result is removed too. This can't be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteFixtureAction({ leagueId, fixtureId });
      if (res.ok) {
        toast.success("Fixture deleted.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={remove}
      aria-label={`Delete ${homeTeamName} vs ${awayTeamName}`}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}

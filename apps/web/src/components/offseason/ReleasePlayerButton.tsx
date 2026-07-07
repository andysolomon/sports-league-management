"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { releaseToFreeAgencyAction } from "@/app/dashboard/_actions/offseason";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface ReleasePlayerButtonProps {
  playerId: string;
  playerName: string;
}

export function ReleasePlayerButton({
  playerId,
  playerName,
}: ReleasePlayerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirmRelease() {
    start(async () => {
      const res = await releaseToFreeAgencyAction({ playerId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${playerName} released to free agency.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={`Release ${playerName}`}
        >
          <UserMinus className="mr-1 h-3.5 w-3.5" aria-hidden />
          Release
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Release player</AlertDialogTitle>
          <AlertDialogDescription>
            Release {playerName} to the free-agent pool? They will be removed
            from upcoming-season roster assignments but remain in the league.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={confirmRelease}>
            {pending ? "Releasing…" : "Release"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

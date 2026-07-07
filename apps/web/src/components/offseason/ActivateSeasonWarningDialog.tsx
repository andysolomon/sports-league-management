"use client";

import type { UndersizedTeam } from "@/lib/offseason-activate";
import { activateSeasonWarningMessage } from "@/lib/offseason-activate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ActivateSeasonWarningDialogProps {
  open: boolean;
  seasonName: string;
  undersizedTeams: UndersizedTeam[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ActivateSeasonWarningDialog({
  open,
  seasonName,
  undersizedTeams,
  busy,
  onCancel,
  onConfirm,
}: ActivateSeasonWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent data-testid="activate-season-warning-dialog">
        <DialogHeader>
          <DialogTitle>Activate with undersized rosters?</DialogTitle>
          <DialogDescription>
            {activateSeasonWarningMessage(undersizedTeams)}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Proceed to make <span className="font-medium text-foreground">{seasonName}</span> the
          active season anyway?
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            data-testid="activate-season-warning-confirm"
          >
            {busy ? "Activating…" : "Proceed anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

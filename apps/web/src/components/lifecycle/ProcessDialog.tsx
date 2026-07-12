"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProcessStageStatus = "pending" | "in_progress" | "complete" | "error";

export interface ProcessStage {
  id: string;
  label: string;
  status: ProcessStageStatus;
  detail?: string;
}

export interface ProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  stages: ProcessStage[];
  pending: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function stageAnnouncement(stage: ProcessStage): string {
  const statusLabel =
    stage.status === "complete"
      ? "completed"
      : stage.status === "error"
        ? "failed"
        : stage.status === "in_progress"
          ? "in progress"
          : "pending";
  return `${stage.label}: ${statusLabel}${stage.detail ? ` — ${stage.detail}` : ""}`;
}

export function ProcessDialog({
  open,
  onOpenChange,
  title,
  description,
  stages,
  pending,
  error = null,
  onRetry,
}: ProcessDialogProps) {
  const liveMessage = React.useMemo(() => {
    const active =
      stages.find((stage) => stage.status === "in_progress") ??
      stages.find((stage) => stage.status === "complete" || stage.status === "error");
    if (active) return stageAnnouncement(active);
    if (pending) return "Processing…";
    return "";
  }, [pending, stages]);

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;
    onOpenChange(next);
  }

  const dismissible = !pending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        role="dialog"
        showCloseButton={dismissible}
        data-testid="process-dialog"
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="process-dialog-live-region"
        >
          {liveMessage}
        </div>

        <ol className="space-y-2" data-testid="process-dialog-stages">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="flex items-start gap-2 text-sm"
              data-stage-id={stage.id}
              data-stage-status={stage.status}
            >
              <span aria-hidden="true" className="mt-0.5 font-mono text-xs text-muted-foreground">
                {stage.status === "complete"
                  ? "✓"
                  : stage.status === "error"
                    ? "!"
                    : stage.status === "in_progress"
                      ? "…"
                      : "○"}
              </span>
              <div>
                <p className="font-medium text-foreground">{stage.label}</p>
                {stage.detail ? (
                  <p className="text-muted-foreground">{stage.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {error ? (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
            data-testid="process-dialog-error"
          >
            <p>{error}</p>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={pending}
                onClick={onRetry}
                data-testid="process-dialog-retry"
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        {dismissible ? (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              data-testid="process-dialog-close"
            >
              Close
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
}

export function ActionConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending: pendingProp,
  error = null,
  onConfirm,
}: ActionConfirmDialogProps) {
  const pending = pendingProp ?? false;
  const hasPendingProp = pendingProp !== undefined;
  const confirmInFlight = React.useRef(false);
  const sawPendingAfterConfirm = React.useRef(false);
  const restoreFocusElement = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      confirmInFlight.current = false;
      sawPendingAfterConfirm.current = false;
      return;
    }

    if (!confirmInFlight.current) return;

    if (pending) {
      sawPendingAfterConfirm.current = true;
    } else if (sawPendingAfterConfirm.current) {
      confirmInFlight.current = false;
      sawPendingAfterConfirm.current = false;
    }
  }, [open, pending]);

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (pending || confirmInFlight.current) return;
    confirmInFlight.current = true;
    sawPendingAfterConfirm.current = false;

    let result: void | Promise<void>;
    try {
      result = onConfirm();
    } catch (error) {
      confirmInFlight.current = false;
      throw error;
    }

    if (!hasPendingProp) {
      try {
        await result;
      } finally {
        confirmInFlight.current = false;
      }
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        data-testid="action-confirm-dialog"
        onOpenAutoFocus={() => {
          restoreFocusElement.current = document.activeElement as HTMLElement | null;
        }}
        onCloseAutoFocus={(event) => {
          const element = restoreFocusElement.current;
          restoreFocusElement.current = null;
          if (element?.isConnected) {
            event.preventDefault();
            element.focus();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild={typeof description !== "string"}>
            {typeof description === "string" ? description : <div>{description}</div>}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
            data-testid="action-confirm-error"
          >
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={pending}
              onClick={() => void handleConfirm()}
              data-testid="action-confirm-retry"
            >
              Retry
            </Button>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            data-testid="action-confirm-cancel"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({
              variant: destructive ? "destructive" : "default",
            })}
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            data-testid="action-confirm-submit"
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

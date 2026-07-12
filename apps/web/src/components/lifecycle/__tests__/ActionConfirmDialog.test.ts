// @vitest-environment jsdom

import { createElement, useState, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";

type AlertDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

type ContentProps = {
  children?: ReactNode;
  onEscapeKeyDown?: (event: { preventDefault: () => void }) => void;
};

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, onOpenChange, children }: AlertDialogProps) => {
    const dialog = open
      ? createElement(
          "div",
          {
            "data-testid": "alert-dialog-root",
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key === "Escape") onOpenChange?.(false);
            },
          },
          children,
        )
      : null;
    mockOpenChange = onOpenChange;
    return dialog;
  },
  AlertDialogContent: ({ children, onEscapeKeyDown }: ContentProps) =>
    createElement(
      "div",
      {
        "data-testid": "action-confirm-dialog",
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            onEscapeKeyDown?.({
              preventDefault: () => event.preventDefault(),
            });
          }
        },
      },
      children,
    ),
  AlertDialogHeader: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  AlertDialogFooter: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  AlertDialogTitle: ({ children }: { children?: ReactNode }) =>
    createElement("h2", null, children),
  AlertDialogDescription: ({ children }: { children?: ReactNode }) =>
    createElement("p", null, children),
  AlertDialogCancel: ({
    children,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement(
      "button",
      {
        type: "button",
        disabled,
        onClick: () => mockOpenChange?.(false),
        ...props,
      },
      children,
    ),
  AlertDialogAction: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement("button", { type: "button", ...props }, children),
}));

let mockOpenChange: AlertDialogProps["onOpenChange"];

function renderDialog(
  props: Partial<React.ComponentProps<typeof ActionConfirmDialog>> & {
    initialOpen?: boolean;
  },
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const trigger = document.createElement("button");
  trigger.textContent = "Trigger";
  document.body.appendChild(trigger);
  trigger.focus();

  let root: Root | null = null;

  function Harness() {
    const [open, setOpen] = useState(props.initialOpen ?? true);
    return createElement(ActionConfirmDialog, {
      open,
      onOpenChange: (next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      },
      title: props.title ?? "Confirm action",
      description: props.description ?? "Are you sure?",
      confirmLabel: props.confirmLabel,
      cancelLabel: props.cancelLabel,
      destructive: props.destructive,
      pending: props.pending,
      error: props.error,
      onConfirm: props.onConfirm ?? (() => undefined),
    });
  }

  act(() => {
    root = createRoot(container);
    root.render(createElement(Harness));
  });

  return {
    container,
    trigger,
    unmount() {
      act(() => {
        root?.unmount();
      });
      container.remove();
      trigger.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ActionConfirmDialog", () => {
  it("renders title and description when open", () => {
    const view = renderDialog({
      title: "Delete item?",
      description: "This cannot be undone.",
    });
    expect(document.body.textContent).toContain("Delete item?");
    expect(document.body.textContent).toContain("This cannot be undone.");
    view.unmount();
  });

  it("calls onConfirm once when confirm is double-clicked", async () => {
    const onConfirm = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 25)),
    );
    renderDialog({ onConfirm, pending: false });

    const confirm = document.querySelector(
      '[data-testid="action-confirm-submit"]',
    ) as HTMLButtonElement;
    await act(async () => {
      confirm.click();
      confirm.click();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("re-arms confirm after pending completes", () => {
    const onConfirm = vi.fn();
    let setPending: (pending: boolean) => void = () => undefined;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Harness() {
      const [pending, updatePending] = useState(false);
      setPending = updatePending;
      return createElement(ActionConfirmDialog, {
        open: true,
        onOpenChange: vi.fn(),
        title: "Confirm action",
        description: "Are you sure?",
        pending,
        onConfirm,
      });
    }

    act(() => {
      root.render(createElement(Harness));
    });

    const confirm = document.querySelector(
      '[data-testid="action-confirm-submit"]',
    ) as HTMLButtonElement;
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => {
      setPending(true);
    });
    act(() => {
      setPending(false);
    });
    act(() => {
      confirm.click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(2);
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("closes on cancel when not pending", () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange, pending: false });

    const cancel = document.querySelector(
      '[data-testid="action-confirm-cancel"]',
    ) as HTMLButtonElement;
    act(() => {
      cancel.click();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks escape dismissal while pending", () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange, pending: true });

    const dialog = document.querySelector(
      '[data-testid="action-confirm-dialog"]',
    ) as HTMLDivElement;
    act(() => {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("allows escape dismissal when not pending", () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange, pending: false });

    const dialog = document.querySelector(
      '[data-testid="action-confirm-dialog"]',
    ) as HTMLDivElement;
    act(() => {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows error copy with retry that re-invokes onConfirm", () => {
    const onConfirm = vi.fn();
    renderDialog({
      error: "Server failed",
      onConfirm,
      pending: false,
    });

    expect(document.body.textContent).toContain("Server failed");
    const retry = document.querySelector(
      '[data-testid="action-confirm-retry"]',
    ) as HTMLButtonElement;
    act(() => {
      retry.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables confirm and cancel buttons while pending", () => {
    renderDialog({ pending: true });
    const confirm = document.querySelector(
      '[data-testid="action-confirm-submit"]',
    ) as HTMLButtonElement;
    const cancel = document.querySelector(
      '[data-testid="action-confirm-cancel"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(cancel.disabled).toBe(true);
  });
});

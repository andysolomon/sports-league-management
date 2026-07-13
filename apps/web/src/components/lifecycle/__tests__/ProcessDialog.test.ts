// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProcessDialog,
  type ProcessStage,
} from "@/components/lifecycle/ProcessDialog";

type DialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

type ContentProps = {
  children?: ReactNode;
  role?: string;
  showCloseButton?: boolean;
  onEscapeKeyDown?: (event: { preventDefault: () => void }) => void;
  onPointerDownOutside?: (event: { preventDefault: () => void }) => void;
  onInteractOutside?: (event: { preventDefault: () => void }) => void;
};

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: DialogProps) =>
    open ? createElement("div", { "data-testid": "dialog-root" }, children) : null,
  DialogContent: ({
    children,
    role,
    onEscapeKeyDown,
    onPointerDownOutside,
    onInteractOutside,
  }: ContentProps) =>
    createElement(
      "div",
      {
        role,
        "data-testid": "process-dialog",
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            onEscapeKeyDown?.({
              preventDefault: () => event.preventDefault(),
            });
          }
        },
        onPointerDown: () => {
          onPointerDownOutside?.({ preventDefault: () => undefined });
        },
        onClick: () => {
          onInteractOutside?.({ preventDefault: () => undefined });
        },
      },
      children,
    ),
  DialogHeader: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  DialogFooter: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  DialogTitle: ({ children }: { children?: ReactNode }) =>
    createElement("h2", null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) =>
    createElement("p", null, children),
}));

const completedStages: ProcessStage[] = [
  { id: "seed", label: "Seed bracket", status: "complete", detail: "8 teams" },
  {
    id: "schedule",
    label: "Schedule games",
    status: "complete",
    detail: "3 rounds",
  },
];

function renderProcessDialog(
  props: Partial<React.ComponentProps<typeof ProcessDialog>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;
  const onOpenChange = props.onOpenChange ?? vi.fn();

  act(() => {
    root = createRoot(container);
    root.render(
      createElement(ProcessDialog, {
        open: props.open ?? true,
        onOpenChange,
        title: props.title ?? "Processing",
        description: props.description,
        stages: props.stages ?? completedStages,
        pending: props.pending ?? false,
        error: props.error,
        onRetry: props.onRetry,
        footer: props.footer,
      }),
    );
  });

  return {
    onOpenChange,
    unmount() {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ProcessDialog", () => {
  it('renders role="dialog" and ordered stages from result payload', () => {
    renderProcessDialog({});
    const dialog = document.querySelector('[data-testid="process-dialog"]');
    expect(dialog?.getAttribute("role")).toBe("dialog");

    const items = document.querySelectorAll("[data-stage-id]");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("data-stage-id")).toBe("seed");
    expect(items[1]?.getAttribute("data-stage-id")).toBe("schedule");
    expect(document.body.textContent).toContain("8 teams");
    expect(document.body.textContent).toContain("3 rounds");
  });

  it("announces stage changes in the polite live region", () => {
    renderProcessDialog({
      stages: [
        { id: "a", label: "Copy rosters", status: "in_progress" },
        { id: "b", label: "Activate season", status: "pending" },
      ],
      pending: true,
    });
    const live = document.querySelector(
      '[data-testid="process-dialog-live-region"]',
    );
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toContain("Copy rosters: in progress");
  });

  it("blocks dismissal while pending", () => {
    const onOpenChange = vi.fn();
    renderProcessDialog({ pending: true, onOpenChange });

    const dialog = document.querySelector(
      '[data-testid="process-dialog"]',
    ) as HTMLDivElement;
    act(() => {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      dialog.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-testid="process-dialog-close"]'),
    ).toBeNull();
  });

  it("renders success footer content but hides it while an error is shown", () => {
    const footer = createElement(
      "a",
      { href: "/dashboard/seasons/s2", "data-testid": "onward-link" },
      "Go to the 2027 offseason hub",
    );

    const view = renderProcessDialog({ footer });
    const link = document.querySelector(
      '[data-testid="process-dialog-footer"] [data-testid="onward-link"]',
    ) as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/dashboard/seasons/s2");
    view.unmount();

    renderProcessDialog({ footer, error: "Mutation failed" });
    expect(
      document.querySelector('[data-testid="process-dialog-footer"]'),
    ).toBeNull();
  });

  it("allows close once finished and shows retry on failure", () => {
    const onRetry = vi.fn();
    const onOpenChange = vi.fn();
    renderProcessDialog({
      pending: false,
      error: "Mutation failed",
      onRetry,
      onOpenChange,
    });

    expect(document.body.textContent).toContain("Mutation failed");
    const retry = document.querySelector(
      '[data-testid="process-dialog-retry"]',
    ) as HTMLButtonElement;
    act(() => {
      retry.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    const close = document.querySelector(
      '[data-testid="process-dialog-close"]',
    ) as HTMLButtonElement;
    act(() => {
      close.click();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// @vitest-environment jsdom

import { createElement, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import {
  ProcessDialog,
  type ProcessStage,
} from "@/components/lifecycle/ProcessDialog";

type RenderedRoot = {
  container: HTMLDivElement;
  rerender: (element: React.ReactElement) => void;
  unmount: () => void;
};

const originalPointerEvent = globalThis.PointerEvent;
const originalResizeObserver = globalThis.ResizeObserver;
const originalScrollIntoView = Element.prototype.scrollIntoView;
const originalHasPointerCapture = Element.prototype.hasPointerCapture;
const originalReleasePointerCapture = Element.prototype.releasePointerCapture;
const originalSetPointerCapture = Element.prototype.setPointerCapture;

function installRadixShims() {
  if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = MouseEvent as typeof PointerEvent;
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
}

function restoreRadixShims() {
  globalThis.PointerEvent = originalPointerEvent;
  globalThis.ResizeObserver = originalResizeObserver;
  Element.prototype.scrollIntoView = originalScrollIntoView;
  Element.prototype.hasPointerCapture = originalHasPointerCapture;
  Element.prototype.releasePointerCapture = originalReleasePointerCapture;
  Element.prototype.setPointerCapture = originalSetPointerCapture;
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }
  throw lastError;
}

function renderRoot(element: React.ReactElement): RenderedRoot {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  act(() => {
    root = createRoot(container);
    root.render(element);
  });

  return {
    container,
    rerender(nextElement) {
      act(() => {
        root?.render(nextElement);
      });
    },
    unmount() {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
}

function dispatchEscape(target: Element) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

function dispatchPointerDownOutside() {
  act(() => {
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 1,
      } as PointerEventInit),
    );
  });
}

function queryActionDialog() {
  return document.querySelector('[data-testid="action-confirm-dialog"]');
}

function queryProcessDialog() {
  return document.querySelector('[data-testid="process-dialog"]');
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  installRadixShims();
});

afterEach(() => {
  document.body.innerHTML = "";
  restoreRadixShims();
});

describe("lifecycle dialogs with real Radix primitives", () => {
  it("focuses the alert dialog cancel action on open and restores prior focus after close", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            type: "button",
            "data-testid": "open-dialog",
            onClick: () => setOpen(true),
          },
          "Open",
        ),
        createElement(ActionConfirmDialog, {
          open,
          onOpenChange: setOpen,
          title: "Confirm archive",
          description: "Archive this season?",
          pending: false,
          onConfirm: vi.fn(),
        }),
      );
    }

    const view = renderRoot(createElement(Harness));
    const opener = document.querySelector(
      '[data-testid="open-dialog"]',
    ) as HTMLButtonElement;
    opener.focus();

    act(() => {
      opener.click();
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(
        document.querySelector('[data-testid="action-confirm-cancel"]'),
      );
    });

    act(() => {
      (
        document.querySelector(
          '[data-testid="action-confirm-cancel"]',
        ) as HTMLButtonElement
      ).click();
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });

    view.unmount();
  });

  it("blocks Escape while pending and allows it when idle", async () => {
    const onOpenChange = vi.fn();
    const view = renderRoot(
      createElement(ActionConfirmDialog, {
        open: true,
        onOpenChange,
        title: "Delete game",
        description: "This cannot be undone.",
        pending: true,
        onConfirm: vi.fn(),
      }),
    );

    await waitFor(() => expect(queryActionDialog()).not.toBeNull());
    dispatchEscape(queryActionDialog() as Element);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(queryActionDialog()).not.toBeNull();

    view.rerender(
      createElement(ActionConfirmDialog, {
        open: true,
        onOpenChange,
        title: "Delete game",
        description: "This cannot be undone.",
        pending: false,
        onConfirm: vi.fn(),
      }),
    );

    dispatchEscape(queryActionDialog() as Element);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    view.unmount();
  });

  it("ignores rapid duplicate activation before a synchronous caller re-renders pending", async () => {
    const onConfirm = vi.fn();

    function Harness() {
      const [pending, setPending] = useState(false);
      return createElement(ActionConfirmDialog, {
        open: true,
        onOpenChange: vi.fn(),
        title: "Generate playoffs",
        description: "Create the bracket?",
        pending,
        onConfirm: () => {
          onConfirm();
          queueMicrotask(() => setPending(true));
        },
      });
    }

    const view = renderRoot(createElement(Harness));
    await waitFor(() => expect(queryActionDialog()).not.toBeNull());

    const submit = document.querySelector(
      '[data-testid="action-confirm-submit"]',
    ) as HTMLButtonElement;
    act(() => {
      submit.click();
      submit.click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();
  });

  it("keeps the process dialog locked while pending and announces stage updates", async () => {
    const onOpenChange = vi.fn();
    const onRetry = vi.fn();
    const initialStages: ProcessStage[] = [
      { id: "copy", label: "Copy rosters", status: "in_progress" },
      { id: "activate", label: "Activate season", status: "pending" },
    ];
    const nextStages: ProcessStage[] = [
      { id: "copy", label: "Copy rosters", status: "complete" },
      { id: "activate", label: "Activate season", status: "in_progress" },
    ];

    const view = renderRoot(
      createElement(ProcessDialog, {
        open: true,
        onOpenChange,
        title: "Activating season",
        stages: initialStages,
        pending: true,
        error: "Activation failed",
        onRetry,
      }),
    );

    await waitFor(() => expect(queryProcessDialog()).not.toBeNull());
    expect(document.querySelector('[data-testid="process-dialog-close"]')).toBeNull();

    dispatchEscape(queryProcessDialog() as Element);
    dispatchPointerDownOutside();
    expect(onOpenChange).not.toHaveBeenCalled();

    const live = document.querySelector(
      '[data-testid="process-dialog-live-region"]',
    );
    expect(live?.textContent).toContain("Copy rosters: in progress");

    const retry = document.querySelector(
      '[data-testid="process-dialog-retry"]',
    ) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
    act(() => {
      retry.click();
    });
    expect(onRetry).not.toHaveBeenCalled();

    view.rerender(
      createElement(ProcessDialog, {
        open: true,
        onOpenChange,
        title: "Activating season",
        stages: nextStages,
        pending: true,
        error: "Activation failed",
        onRetry,
      }),
    );

    expect(live?.textContent).toContain("Activate season: in progress");
    view.unmount();
  });
});

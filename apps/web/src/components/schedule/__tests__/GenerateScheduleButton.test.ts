// @vitest-environment jsdom

import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGenerateScheduleAction,
  mockRefresh,
} = vi.hoisted(() => ({
  mockGenerateScheduleAction: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/app/dashboard/leagues/[id]/schedule/actions", () => ({
  generateScheduleAction: mockGenerateScheduleAction,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? createElement("div", { "data-testid": "dialog-root" }, children) : null,
  DialogContent: ({
    children,
    role,
  }: {
    children?: React.ReactNode;
    role?: string;
  }) =>
    createElement(
      "div",
      { role, "data-testid": "process-dialog" },
      children,
    ),
  DialogHeader: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children),
  DialogFooter: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children),
  DialogTitle: ({ children }: { children?: React.ReactNode }) =>
    createElement("h2", null, children),
  DialogDescription: ({ children }: { children?: React.ReactNode }) =>
    createElement("p", null, children),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? createElement("div", { "data-testid": "action-confirm-dialog" }, children) : null,
  AlertDialogContent: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children),
  AlertDialogHeader: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children),
  AlertDialogFooter: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children),
  AlertDialogTitle: ({ children }: { children?: React.ReactNode }) =>
    createElement("h2", null, children),
  AlertDialogDescription: ({ children }: { children?: React.ReactNode }) =>
    createElement("p", null, children),
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) =>
    createElement("button", { type: "button", onClick }, children),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: (event: { preventDefault: () => void }) => void;
  }) =>
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "action-confirm-submit",
        onClick: (event: { preventDefault: () => void }) => onClick?.(event),
      },
      children,
    ),
}));

import GenerateScheduleButton from "@/components/schedule/GenerateScheduleButton";

function renderButton() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  act(() => {
    root = createRoot(container);
    root.render(
      createElement(GenerateScheduleButton, {
        leagueId: "league-1",
        seasonId: "season-1",
        seasonName: "2026",
        hasFixtures: false,
      }),
    );
  });

  return {
    container,
    unmount() {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("GenerateScheduleButton ProcessDialog wiring", () => {
  it("shows schedule-specific stages after a successful generation", async () => {
    mockGenerateScheduleAction.mockResolvedValue({
      ok: true,
      created: 28,
      weeks: 7,
      teamCount: 8,
    });

    renderButton();
    const button = document.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const stage = document.querySelector('[data-stage-id="generate"]');
    expect(stage?.getAttribute("data-stage-status")).toBe("complete");
    expect(document.body.textContent).toContain("28 games · 7 weeks · 8 teams");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("marks the schedule stage failed on action error", async () => {
    mockGenerateScheduleAction.mockResolvedValue({
      ok: false,
      error: "season_not_found",
    });

    renderButton();
    const button = document.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const stage = document.querySelector('[data-stage-id="generate"]');
    expect(stage?.getAttribute("data-stage-status")).toBe("error");
    expect(document.body.textContent).toContain("This season no longer exists.");
  });
});

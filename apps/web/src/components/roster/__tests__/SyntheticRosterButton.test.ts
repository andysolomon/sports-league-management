// @vitest-environment jsdom

import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGenerateLeagueRostersAction,
  mockRefresh,
} = vi.hoisted(() => ({
  mockGenerateLeagueRostersAction: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/app/dashboard/_actions/synthetic-rosters", () => ({
  generateTeamRosterAction: vi.fn(),
  generateLeagueRostersAction: mockGenerateLeagueRostersAction,
  clearTeamSyntheticAction: vi.fn(),
  clearLeagueSyntheticAction: vi.fn(),
  generateTeamAttributesAction: vi.fn(),
  generateLeagueAttributesAction: vi.fn(),
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

import { SyntheticRosterButton } from "@/components/roster/SyntheticRosterButton";

function renderButton() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  act(() => {
    root = createRoot(container);
    root.render(
      createElement(SyntheticRosterButton, {
        kind: "league",
        id: "league-1",
        action: "generate",
      }),
    );
  });

  return {
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

describe("SyntheticRosterButton ProcessDialog wiring", () => {
  it("confirms then shows roster fill stages from action results", async () => {
    mockGenerateLeagueRostersAction.mockResolvedValue({
      ok: true,
      teams: 2,
      created: 96,
    });

    renderButton();
    const trigger = document.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });

    const confirm = document.querySelector(
      '[data-testid="action-confirm-submit"]',
    ) as HTMLButtonElement;
    await act(async () => {
      confirm.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const stage = document.querySelector('[data-stage-id="fill"]');
    expect(stage?.getAttribute("data-stage-status")).toBe("complete");
    expect(document.body.textContent).toContain("96 players across 2 teams");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("marks roster generation failed when the action rejects", async () => {
    mockGenerateLeagueRostersAction.mockResolvedValue({
      ok: false,
      error: "not_authorized",
    });

    renderButton();
    const trigger = document.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });
    const confirm = document.querySelector(
      '[data-testid="action-confirm-submit"]',
    ) as HTMLButtonElement;
    await act(async () => {
      confirm.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const stage = document.querySelector('[data-stage-id="fill"]');
    expect(stage?.getAttribute("data-stage-status")).toBe("error");
    expect(document.body.textContent).toContain("You don't have permission");
  });
});

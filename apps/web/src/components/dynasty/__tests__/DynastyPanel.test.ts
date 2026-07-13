// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessStage } from "@/components/lifecycle/ProcessDialog";
import type { RolloverOperationSummary } from "@/lib/rollover-summary";

const { mockStartNextSeason, mockRefresh } = vi.hoisted(() => ({
  mockStartNextSeason: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("@/app/dashboard/_actions/dynasty", () => ({
  startNextSeasonAction: mockStartNextSeason,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
  }) => createElement("a", { href, ...rest }, children),
}));
// Auto-confirm: surface a confirm button whenever the dialog is open.
vi.mock("@/components/lifecycle/ActionConfirmDialog", () => ({
  ActionConfirmDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: () => void;
  }) =>
    open
      ? createElement(
          "button",
          { type: "button", "data-testid": "confirm-start", onClick: onConfirm },
          "Confirm",
        )
      : null,
}));
// Render stages + footer inline so we can assert DynastyPanel's wiring.
vi.mock("@/components/lifecycle/ProcessDialog", () => ({
  ProcessDialog: ({
    open,
    stages,
    footer,
    error,
  }: {
    open: boolean;
    stages: ProcessStage[];
    footer?: ReactNode;
    error?: string | null;
  }) =>
    open
      ? createElement(
          "div",
          { "data-testid": "process-dialog" },
          createElement(
            "ul",
            null,
            stages.map((stage) =>
              createElement(
                "li",
                {
                  key: stage.id,
                  "data-stage-id": stage.id,
                  "data-stage-detail": stage.detail ?? "",
                  "data-stage-status": stage.status,
                },
                stage.label,
              ),
            ),
          ),
          error
            ? createElement("p", { "data-testid": "dialog-error" }, error)
            : null,
          footer
            ? createElement("div", { "data-testid": "dialog-footer" }, footer)
            : null,
        )
      : null,
}));

import { DynastyPanel } from "@/components/dynasty/DynastyPanel";

const summary: RolloverOperationSummary = {
  sourceSeason: { id: "season_active", name: "2026" },
  targetSeason: { id: "season_next", name: "2027" },
  graduation: { players: 8 },
  advancement: { players: 42 },
  progression: { snapshots: 42 },
  carryover: {
    copiedAssignments: 40,
    copiedDepthEntries: 20,
    removedAssignments: 8,
    removedDepthEntries: 4,
  },
  recruiting: { freshmen: 47, toPool: false },
};

const baseProps = {
  leagueId: "league_1",
  seasonState: {
    seasonName: "2026",
    status: "decided" as const,
    statusLabel: "Decided",
  },
  gate: { canStart: true, errorCode: null, message: null },
  classDistribution: { FR: 1, SO: 1, JR: 1, SR: 1, unknown: 0 },
  graduatedPlayers: [],
  upcomingSeason: null,
  unplayedGames: 0,
  playoffsUndecided: false,
};

let container: HTMLDivElement;
let root: Root | null = null;

function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(createElement(DynastyPanel, baseProps));
  });
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

function startButton(): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll("button"));
  const button = buttons.find((b) =>
    (b.textContent ?? "").includes("Start next season"),
  );
  if (!button) throw new Error("Start next season button not found");
  return button as HTMLButtonElement;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockStartNextSeason.mockReset();
  mockRefresh.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container.remove();
  document.body.innerHTML = "";
});

describe("DynastyPanel rollover flow", () => {
  it("shows persisted stages and an accessible offseason-hub link on success", async () => {
    mockStartNextSeason.mockResolvedValue({
      ok: true,
      seasonId: "season_next",
      seasonName: "2027",
      graduated: 8,
      advanced: 42,
      progressed: 42,
      freshmen: 47,
      summary,
    });

    render();
    act(() => startButton().click());
    act(() => {
      (
        document.querySelector(
          '[data-testid="confirm-start"]',
        ) as HTMLButtonElement
      ).click();
    });

    await waitFor(() => {
      const link = document.querySelector(
        '[data-testid="dynasty-offseason-link"]',
      ) as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
    });

    // Truthful, persisted stage details threaded from the summary.
    const detailFor = (id: string) =>
      document
        .querySelector(`[data-stage-id="${id}"]`)
        ?.getAttribute("data-stage-detail");
    expect(detailFor("graduate")).toBe("8 players");
    expect(detailFor("advance")).toBe("42 players");
    expect(detailFor("progress")).toBe("42 snapshots");
    expect(detailFor("carryover")).toBe(
      "40 assignments · 20 depth carried, 8 assignments · 4 depth removed",
    );
    expect(detailFor("freshmen")).toBe("47 players");

    // Accessible onward link to the new season's offseason hub.
    const link = document.querySelector(
      '[data-testid="dynasty-offseason-link"]',
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/dashboard/seasons/season_next");
    expect(link.textContent).toContain("2027 offseason hub");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("surfaces a precondition error and no onward link on failure", async () => {
    mockStartNextSeason.mockResolvedValue({
      ok: false,
      error: "next_season_exists",
    });

    render();
    act(() => startButton().click());
    act(() => {
      (
        document.querySelector(
          '[data-testid="confirm-start"]',
        ) as HTMLButtonElement
      ).click();
    });

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="dialog-error"]'),
      ).not.toBeNull();
    });
    expect(
      document.querySelector('[data-testid="dynasty-offseason-link"]'),
    ).toBeNull();
  });
});

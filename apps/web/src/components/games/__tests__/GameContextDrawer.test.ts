// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameContextDrawer } from "@/components/games/GameContextDrawer";
import type { GameDrawerProjection } from "@/lib/game-drawer-projection";

type SheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

type ContentProps = {
  children?: ReactNode;
  className?: string;
  side?: string;
  "data-testid"?: string;
  "aria-labelledby"?: string;
};

let mockOpenChange: ((open: boolean) => void) | undefined;

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, onOpenChange, children }: SheetProps) => {
    mockOpenChange = onOpenChange;
    return open
      ? createElement("div", { "data-testid": "sheet-root", role: "dialog" }, children)
      : null;
  },
  SheetContent: ({ children, ...props }: ContentProps) =>
    createElement("div", { "data-testid": props["data-testid"] ?? "sheet-content" }, children),
  SheetClose: ({ children }: { children?: ReactNode }) =>
    createElement("button", { type: "button", onClick: () => mockOpenChange?.(false) }, children),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

const scheduledProjection: GameDrawerProjection = {
  id: "fx1",
  surface: "schedule",
  fixtureId: "fx1",
  status: "scheduled",
  home: { id: "h1", name: "Alpha", seed: null, record: "2-1" },
  away: { id: "a1", name: "Beta", seed: null, record: "1-2" },
  scheduledAt: "2026-07-01T18:00:00.000Z",
  venue: "Memorial Field",
  homeScore: null,
  awayScore: null,
  hasPlayLog: false,
  roundLabel: null,
  isBye: false,
};

const finalProjection: GameDrawerProjection = {
  ...scheduledProjection,
  status: "final",
  homeScore: 21,
  awayScore: 14,
  hasPlayLog: true,
};

describe("GameContextDrawer", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  function renderDrawer(
    projection: GameDrawerProjection | null,
    open = true,
  ) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        createElement(GameContextDrawer, {
          projection,
          open,
          onOpenChange: vi.fn(),
        }),
      );
    });
  }

  it("renders preview mode for scheduled games", () => {
    renderDrawer(scheduledProjection);
    expect(container.textContent).toContain("Preview");
    expect(container.textContent).toContain("Alpha vs Beta");
    expect(container.textContent).toContain("Memorial Field");
    expect(container.textContent).toContain("2-1");
    expect(container.querySelector('[data-testid="game-drawer-open-gamecast"]')).toBeNull();
  });

  it("renders final summary and gamecast link when play log exists", () => {
    renderDrawer(finalProjection);
    expect(container.textContent).toContain("Final");
    expect(container.textContent).toContain("21");
    expect(container.textContent).toContain("14");
    const link = container.querySelector('[data-testid="game-drawer-open-gamecast"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/dashboard/games/fx1/gamecast");
  });

  it("renders nothing when closed", () => {
    renderDrawer(scheduledProjection, false);
    expect(container.querySelector('[data-testid="game-context-drawer"]')).toBeNull();
  });
});

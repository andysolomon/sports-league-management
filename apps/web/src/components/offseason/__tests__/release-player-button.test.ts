import { createElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { ReleasePlayerButton } from "@/components/offseason/ReleasePlayerButton";

describe("ReleasePlayerButton", () => {
  it("renders a release control with an accessible label", () => {
    const html = renderToStaticMarkup(
      createElement(ReleasePlayerButton, {
        playerId: "player_1",
        playerName: "Alex Alpha",
      }),
    );
    expect(html).toContain("Release");
    expect(html).toContain("Release Alex Alpha");
  });
});

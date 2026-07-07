import { createElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { DraftStartToggle } from "@/components/offseason/DraftStartToggle";

describe("DraftStartToggle", () => {
  it("renders the admin start-draft control", () => {
    const html = renderToStaticMarkup(
      createElement(DraftStartToggle, {
        leagueId: "league-1",
        seasonId: "season-1",
      }),
    );
    expect(html).toContain('data-testid="draft-start-toggle"');
    expect(html).toContain('aria-label="Start draft"');
    expect(html).toContain("Free agency remains available below.");
  });
});

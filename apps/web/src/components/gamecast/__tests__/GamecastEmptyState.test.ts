import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GamecastEmptyState, {
  gamecastEmptyMessage,
} from "@/components/gamecast/GamecastEmptyState";

describe("GamecastEmptyState", () => {
  it("renders the no-log message and schedule link", () => {
    const html = renderToStaticMarkup(
      createElement(GamecastEmptyState, {
        leagueId: "league-1",
        reason: "no_log",
      }),
    );
    expect(html).toContain(gamecastEmptyMessage("no_log"));
    expect(html).toContain("/dashboard/leagues/league-1/schedule");
    expect(html).toContain("Back to schedule");
  });

  it("renders parse-error copy", () => {
    const html = renderToStaticMarkup(
      createElement(GamecastEmptyState, {
        leagueId: "league-2",
        reason: "parse_error",
      }),
    );
    expect(html).toContain(gamecastEmptyMessage("parse_error"));
  });
});

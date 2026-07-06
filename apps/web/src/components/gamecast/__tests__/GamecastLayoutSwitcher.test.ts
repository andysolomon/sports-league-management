import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GamecastLayoutSwitcher from "@/components/gamecast/GamecastLayoutSwitcher";

describe("GamecastLayoutSwitcher", () => {
  it("renders three layout options", () => {
    const html = renderToStaticMarkup(
      createElement(GamecastLayoutSwitcher, {
        value: "broadcast",
        onChange: () => {},
      }),
    );
    expect(html).toContain('data-testid="gamecast-layout-switcher"');
    expect(html).toContain('data-testid="gamecast-layout-broadcast"');
    expect(html).toContain('data-testid="gamecast-layout-field-first"');
    expect(html).toContain('data-testid="gamecast-layout-operator"');
    expect(html).toContain("Broadcast");
    expect(html).toContain("Field-first");
    expect(html).toContain("Operator");
  });
});

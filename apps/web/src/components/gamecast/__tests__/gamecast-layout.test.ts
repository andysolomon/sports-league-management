import { describe, expect, it } from "vitest";
import {
  GAMECAST_LAYOUT_STORAGE_KEY,
  GAMECAST_LAYOUTS,
  isGamecastLayout,
  normalizeGamecastLayout,
} from "@/components/gamecast/gamecast-layout";

describe("gamecast layout storage", () => {
  it("uses the expected localStorage key", () => {
    expect(GAMECAST_LAYOUT_STORAGE_KEY).toBe("gamecast:layout");
  });

  it("recognizes valid layout ids", () => {
    for (const layout of GAMECAST_LAYOUTS) {
      expect(isGamecastLayout(layout)).toBe(true);
    }
    expect(isGamecastLayout("invalid")).toBe(false);
  });

  it("normalizes missing or invalid values to broadcast", () => {
    expect(normalizeGamecastLayout(undefined)).toBe("broadcast");
    expect(normalizeGamecastLayout(null)).toBe("broadcast");
    expect(normalizeGamecastLayout("")).toBe("broadcast");
    expect(normalizeGamecastLayout("nope")).toBe("broadcast");
  });

  it("preserves valid stored layouts", () => {
    expect(normalizeGamecastLayout("field-first")).toBe("field-first");
    expect(normalizeGamecastLayout("operator")).toBe("operator");
    expect(normalizeGamecastLayout("broadcast")).toBe("broadcast");
  });
});

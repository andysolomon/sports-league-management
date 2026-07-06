import { describe, it, expect } from "vitest";
import { deriveTeamDisplay } from "@/lib/gamecast/team-display";

describe("deriveTeamDisplay", () => {
  it("derives a three-letter uppercase abbreviation from the team name", () => {
    expect(deriveTeamDisplay("Wheeler").abbr).toBe("WHE");
    expect(deriveTeamDisplay("Hillgrove High").abbr).toBe("HIL");
  });

  it("uses the primary color when it is a valid hex value", () => {
    expect(deriveTeamDisplay("Wheeler", "#3d6fe6").color).toBe("#3d6fe6");
  });

  it("falls back to the neutral token when color is missing or invalid", () => {
    expect(deriveTeamDisplay("Wheeler").color).toBe("var(--text-subtle)");
    expect(deriveTeamDisplay("Wheeler", "blue").color).toBe("var(--text-subtle)");
    expect(deriveTeamDisplay("Wheeler", "#abc").color).toBe("var(--text-subtle)");
    expect(deriveTeamDisplay("Wheeler", null).color).toBe("var(--text-subtle)");
  });

  it("uses TM when the name is empty", () => {
    expect(deriveTeamDisplay("").abbr).toBe("TM");
    expect(deriveTeamDisplay("   ").abbr).toBe("TM");
  });
});

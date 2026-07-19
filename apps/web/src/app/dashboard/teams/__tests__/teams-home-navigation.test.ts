import { describe, expect, it } from "vitest";
import { divisionsViewHref, teamsHomeView } from "../teams-home-navigation";

describe("Teams Home navigation", () => {
  it("uses Teams unless the canonical Divisions view is requested", () => {
    expect(teamsHomeView(undefined)).toBe("teams");
    expect(teamsHomeView("unknown")).toBe("teams");
    expect(teamsHomeView("divisions")).toBe("divisions");
    expect(teamsHomeView(["divisions", "teams"])).toBe("divisions");
  });

  it("constructs canonical Division view URLs", () => {
    expect(divisionsViewHref()).toBe("/dashboard/teams?view=divisions");
    expect(divisionsViewHref("division 1")).toBe(
      "/dashboard/teams?view=divisions&division=division+1",
    );
  });
});

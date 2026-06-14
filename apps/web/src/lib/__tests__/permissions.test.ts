import { describe, it, expect } from "vitest";
import {
  ORG_ROLES,
  isOrgRole,
  canManageOrgSettings,
  canManageRoster,
  canView,
  roleLabel,
  type OrgRole,
} from "../permissions";

describe("permissions", () => {
  it("exposes exactly the three roles", () => {
    expect(ORG_ROLES).toEqual(["admin", "coach", "viewer"]);
  });

  describe("isOrgRole", () => {
    it.each(["admin", "coach", "viewer"])("accepts %s", (r) => {
      expect(isOrgRole(r)).toBe(true);
    });
    it.each(["org:admin", "org:member", "", null, undefined, 1])(
      "rejects %s",
      (r) => {
        expect(isOrgRole(r)).toBe(false);
      },
    );
  });

  describe("canManageOrgSettings (admin only)", () => {
    const cases: Array<[OrgRole | null, boolean]> = [
      ["admin", true],
      ["coach", false],
      ["viewer", false],
      [null, false],
    ];
    it.each(cases)("%s → %s", (role, expected) => {
      expect(canManageOrgSettings(role)).toBe(expected);
    });
  });

  describe("canManageRoster (admin or coach)", () => {
    const cases: Array<[OrgRole | null, boolean]> = [
      ["admin", true],
      ["coach", true],
      ["viewer", false],
      [null, false],
    ];
    it.each(cases)("%s → %s", (role, expected) => {
      expect(canManageRoster(role)).toBe(expected);
    });
  });

  describe("canView (any seat)", () => {
    const cases: Array<[OrgRole | null, boolean]> = [
      ["admin", true],
      ["coach", true],
      ["viewer", true],
      [null, false],
    ];
    it.each(cases)("%s → %s", (role, expected) => {
      expect(canView(role)).toBe(expected);
    });
  });

  it("labels roles with a capital", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("coach")).toBe("Coach");
    expect(roleLabel("viewer")).toBe("Viewer");
  });
});

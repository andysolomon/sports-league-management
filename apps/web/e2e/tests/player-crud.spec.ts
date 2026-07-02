import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { pickSelectOption } from "../helpers/select";
import { TEAMS, PLAYERS } from "../helpers/test-data";

// Rewritten for #434: position/jersey/status are Radix <Select>s (combobox
// trigger buttons), driven via pickSelectOption — only name/DOB/hometown are
// still text inputs. Two more renames since the original spec: the roster
// table abbreviates names ("E2E Test Player" renders as "E. Test Player"),
// so rows match on the preserved tail; and the row actions are icon-only
// buttons selected by their aria-labels ("Edit {name}" / "Delete {name}").
//
// The tests form an ordered chain (create → edit → delete) against the
// canonical Cowboys roster; the suite runs serially (workers=1), and the
// canonical fixture is re-seeded per run, so leftovers from a failed chain
// don't leak across runs.
test.describe("Player CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    // Navigate to Cowboys team detail page
    await page.goto("/dashboard/teams");
    await page.locator("a", { hasText: TEAMS.COWBOYS.name }).click();
    await expect(page.getByRole("heading", { name: TEAMS.COWBOYS.name })).toBeVisible();
  });

  test("Add Player dialog opens with form fields", async ({ page }) => {
    await page.getByRole("button", { name: "Add Player" }).click();

    await expect(page.getByRole("heading", { name: "Add Player" })).toBeVisible();
    await expect(page.locator("#player-name")).toBeVisible();
    await expect(page.locator("#player-position")).toBeVisible();
    await expect(page.locator("#player-jersey")).toBeVisible();
    await expect(page.locator("#player-status")).toBeVisible();
  });

  test("create player with valid data", async ({ page }) => {
    await page.getByRole("button", { name: "Add Player" }).click();

    await page.locator("#player-name").fill("E2E Test Player");
    await pickSelectOption(page, "#player-position", "TE");
    await pickSelectOption(page, "#player-jersey", "99");
    // Status defaults to Active

    await page.getByRole("button", { name: "Add Player" }).last().click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });

    // Verify player appears in roster (names render abbreviated).
    await expect(
      page.locator("tbody tr", { hasText: "Test Player" }),
    ).toBeVisible();
  });

  test("form validation prevents empty name", async ({ page }) => {
    await page.getByRole("button", { name: "Add Player" }).click();

    // Pick a position but leave the required name empty and try to submit.
    await pickSelectOption(page, "#player-position", "TE");
    await page.getByRole("button", { name: "Add Player" }).last().click();

    // Dialog should stay open (validation error)
    await expect(page.getByRole("heading", { name: "Add Player" })).toBeVisible();
  });

  test("edit opens pre-populated dialog", async ({ page }) => {
    const row = page.locator("tbody tr", { hasText: "Test Player" });
    await row.getByRole("button", { name: /^Edit / }).click();

    await expect(page.getByRole("heading", { name: "Edit Player" })).toBeVisible();
    await expect(page.locator("#player-name")).toHaveValue("E2E Test Player");
    // Select triggers render their selected value as text, not an input value.
    await expect(page.locator("#player-position")).toContainText("TE");
    await expect(page.locator("#player-jersey")).toContainText("99");
  });

  test("edit saves changes", async ({ page }) => {
    const row = page.locator("tbody tr", { hasText: "Test Player" });
    await row.getByRole("button", { name: /^Edit / }).click();

    await pickSelectOption(page, "#player-position", "WR");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("tbody tr", { hasText: "Test Player" }),
    ).toContainText("WR");
  });

  test("delete with confirmation removes player", async ({ page }) => {
    const row = page.locator("tbody tr", { hasText: "Test Player" });
    await row.getByRole("button", { name: /^Delete / }).click();

    await expect(page.getByRole("heading", { name: "Delete Player" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("tbody tr", { hasText: "Test Player" }),
    ).toHaveCount(0);
  });

  test("delete cancel keeps player in roster", async ({ page }) => {
    // Rows show abbreviated names, so match on the surname.
    const row = page.locator("tbody tr", { hasText: "Prescott" });
    await row.getByRole("button", { name: /^Delete / }).click();

    await expect(page.getByRole("heading", { name: "Delete Player" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Prescott should still be visible
    await expect(row).toBeVisible();
    await expect(row).toContainText(String(PLAYERS.PRESCOTT.jersey));
  });

  test("error toast on failed mutation", async ({ page }) => {
    // Intercept player creation API with 500 error
    await page.route("**/api/players**", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) });
      }
      return route.continue();
    });

    await page.getByRole("button", { name: "Add Player" }).click();
    await page.locator("#player-name").fill("Error Test Player");
    await pickSelectOption(page, "#player-position", "QB");
    await page.getByRole("button", { name: "Add Player" }).last().click();

    // Error toast should appear
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
  });
});

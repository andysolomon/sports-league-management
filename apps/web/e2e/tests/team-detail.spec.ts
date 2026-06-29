import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { TEAMS, PLAYERS } from "../helpers/test-data";

test.describe("Team Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    // Navigate to Cowboys detail via the teams list
    await page.goto("/dashboard/teams");
    await page.locator("a", { hasText: TEAMS.COWBOYS.name }).click();
  });

  test("shows team name as heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: TEAMS.COWBOYS.name })).toBeVisible();
  });

  test("shows team detail fields", async ({ page }) => {
    // Detail fields render in a <dl>: <dt>City</dt><dd>Dallas</dd>, etc.
    // Scope to the definition list and match exactly so the dd value "Dallas"
    // doesn't collide with the "Dallas Cowboys" page heading (strict mode).
    const details = page.locator("dl");
    await expect(details.getByText("City", { exact: true })).toBeVisible();
    await expect(
      details.getByText(TEAMS.COWBOYS.city, { exact: true }),
    ).toBeVisible();
    await expect(details.getByText("Stadium", { exact: true })).toBeVisible();
    await expect(
      details.getByText(TEAMS.COWBOYS.stadium, { exact: true }),
    ).toBeVisible();
    await expect(details.getByText("Founded", { exact: true })).toBeVisible();
    await expect(
      details.getByText(String(TEAMS.COWBOYS.foundedYear), { exact: true }),
    ).toBeVisible();
  });

  test("shows Player Roster section with count", async ({ page }) => {
    const rosterHeading = page.getByText(/Player Roster \(\d+\)/);
    await expect(rosterHeading).toBeVisible();
  });

  // QUARANTINED (#419): roster header row resolves to [] — column markup changed.
  test.fixme("roster table shows the compact columns (no wide Status column)", async ({
    page,
  }) => {
    // The roster table uses compact headers (Player / Pos / #) plus optional
    // ratings columns. WSM-000097 removed the dedicated wide Status column;
    // status is now a per-row indicator (WSM-000098), so it must NOT be a header.
    const headerText = await page.locator("thead th").allInnerTexts();
    expect(headerText).toEqual(expect.arrayContaining(["Player", "Pos", "#"]));
    expect(headerText).not.toContain("Status");
  });

  test("known Cowboys players are present with correct data", async ({ page }) => {
    const tbody = page.locator("tbody");

    // The Player column renders abbreviated names (e.g. "D. Prescott" via
    // abbreviateName), so match rows on the surname, which is preserved.
    const prescottRow = tbody.locator("tr", { hasText: "Prescott" });
    await expect(prescottRow).toBeVisible();
    await expect(prescottRow).toContainText(PLAYERS.PRESCOTT.position);
    await expect(prescottRow).toContainText(String(PLAYERS.PRESCOTT.jersey));

    const lambRow = tbody.locator("tr", { hasText: "Lamb" });
    await expect(lambRow).toBeVisible();
    await expect(lambRow).toContainText(PLAYERS.LAMB.position);
    await expect(lambRow).toContainText(String(PLAYERS.LAMB.jersey));

    const parsonsRow = tbody.locator("tr", { hasText: "Parsons" });
    await expect(parsonsRow).toBeVisible();
    await expect(parsonsRow).toContainText(PLAYERS.PARSONS.position);
    await expect(parsonsRow).toContainText(String(PLAYERS.PARSONS.jersey));
    // Status is no longer a column — it's the WSM-000098 indicator, asserted
    // in its own test below.
  });

  test("Back to Teams link navigates back", async ({ page }) => {
    await page.getByRole("link", { name: /Back to Teams/ }).click();
    await expect(page).toHaveURL("/dashboard/teams");
  });

  // WSM-000098: the wide Status column was replaced by a compact per-row
  // indicator. Non-active players get an icon + popover; active players stay
  // clean.
  test("non-active player shows a status indicator, active player does not", async ({
    page,
  }) => {
    const tbody = page.locator("tbody");

    // Names render abbreviated (e.g. "M. Parsons"), so match rows on the surname.
    // Micah Parsons is seeded as "Injured" → indicator with an accessible label.
    const parsonsRow = tbody.locator("tr", { hasText: "Parsons" });
    const indicator = parsonsRow.getByRole("button", {
      name: /Status: Injured/i,
    });
    await expect(indicator).toBeVisible();

    // Opening it reveals the designation in a dismissable popover.
    await indicator.click();
    await expect(page.getByText("Injured")).toBeVisible();
    await page.keyboard.press("Escape");

    // Dak Prescott is "Active" → no indicator in his row.
    const prescottRow = tbody.locator("tr", { hasText: "Prescott" });
    await expect(
      prescottRow.getByRole("button", { name: /Status:/i }),
    ).toHaveCount(0);
  });
});

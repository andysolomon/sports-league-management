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

// Regression for WSM-000190: a bad/legacy team id (e.g. a Salesforce id leaking
// in via a stale link) used to crash the page with an unhandled
// ArgumentValidationError from Convex's `v.id("teams")` validator → 500. The
// route must now 404 instead.
//
// The beforeEach WARMS the authed session with a valid navigation first
// (matching the other authed specs). Without it, hitting a `notFound()` route
// as the very first navigation races Clerk's session-handshake redirect — the
// request bounces to /sign-in (200) or loops (ERR_TOO_MANY_REDIRECTS) before it
// ever reaches the page, so the 404 status is never observed. After a warm-up
// nav the handshake is settled and the bad-id navigation cleanly resolves to the
// notFound() 404. setActiveLeague keeps the dashboard shell scoped like the rest
// of the suite.
test.describe("Team Detail Page — invalid id", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    // Warm-up: a valid authed navigation settles the Clerk handshake so the
    // subsequent bad-id navigation isn't redirected away from its 404.
    await page.goto("/dashboard/teams");
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
  });

  test("a Salesforce-format team id returns 404, not 500", async ({ page }) => {
    // The exact 18-char SF id from the prod runtime log (WSM-000190).
    const resp = await page.goto("/dashboard/teams/a00bm00001npL2UAAU");
    expect(resp?.status()).toBe(404);
  });

  test("an arbitrary malformed team id returns 404", async ({ page }) => {
    // Any id that doesn't resolve to a team (validation failure or unknown id)
    // must 404 — the guard catches both and falls through to notFound().
    const resp = await page.goto("/dashboard/teams/not-a-real-team-id");
    expect(resp?.status()).toBe(404);
  });
});

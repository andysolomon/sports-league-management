import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { signInTestUser } from "../helpers/clerk-signin";
import { LEAGUES, TEAMS } from "../helpers/test-data";

/*
 * League info destination (WSM-000254) — read-oriented league home split from
 * admin manage settings.
 */
test.describe("League info destination (WSM-000254)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
  });

  test("info page renders header, current season, standings, and teams grid", async ({
    page,
  }) => {
    const { leagueId } = readCanonicalFixture();

    await page.goto(`/dashboard/leagues/${leagueId}`);

    await expect(
      page.getByTestId("resource-header-league").getByText(LEAGUES.NFL),
    ).toBeVisible();
    await expect(page.getByText("Organization")).toBeVisible();
    await expect(page.getByText(/\d+ teams · \d+ seasons/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage", exact: true }),
    ).toBeVisible();
    // ASR-21 removed the generic Seasons header action; the Active Season card
    // below is the stable assertion (the shared canonical league's active
    // season is not guaranteed at every point in a CI run, so the conditional
    // "Open Active Season" header link is not asserted here).
    await expect(page.getByTestId("league-current-season")).toBeVisible();
    await expect(
      page.getByTestId("league-current-season").getByText("Active Season", { exact: true }),
    ).toBeVisible();

    await expect(page.getByTestId("league-standings-card")).toBeVisible();
    await expect(
      page.getByTestId("league-standings-card").getByText("Standings"),
    ).toBeVisible();

    const teamsGrid = page.getByTestId("league-teams-grid");
    await expect(teamsGrid).toBeVisible();
    // CardTitle renders a div, not a heading role — assert the title text.
    await expect(teamsGrid.getByText(/Teams \(\d+\)/)).toBeVisible();
    await expect(teamsGrid.getByText(TEAMS.COWBOYS.name)).toBeVisible();
    await expect(teamsGrid.getByText(TEAMS.PATRIOTS.name)).toBeVisible();
  });

  test("admin settings are on manage, not the info page", async ({ page }) => {
    const { leagueId } = readCanonicalFixture();

    await page.goto(`/dashboard/leagues/${leagueId}`);
    await expect(
      page.getByRole("button", { name: /Make public|Make private/ }),
    ).toHaveCount(0);
    await expect(page.getByPlaceholder("user@example.com")).toHaveCount(0);

    // #576: Manage lands on League Settings for the Active League (the info
    // page already synced it to this league).
    await page.getByRole("link", { name: "Manage", exact: true }).click();
    await expect(page).toHaveURL("/dashboard/settings/league");
    await expect(page.getByTestId("league-manage-settings")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Make public|Make private/ }).first(),
    ).toBeVisible();
  });
});

test.describe("League manage access (WSM-000254)", () => {
  // This block signs in as the org-B user itself, so it must not inherit the
  // shared signed-in storageState — `clerk.signIn` throws "already signed in"
  // otherwise (WSM-000172). Start each test from a clean, signed-out context.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("non-member cannot reach manage settings", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await signInTestUser(page, { userVariant: "B" });

    const { leagueId } = readCanonicalFixture();
    // #576: the legacy manage URL is now an access-validated redirect to
    // /dashboard/settings/league — probing it must still 404 without
    // disclosing the league.
    await page.goto(`/dashboard/leagues/${leagueId}/manage`);

    await expect(page.getByRole("heading", { name: /^404$/ })).toBeVisible();
    await expect(page.getByTestId("league-manage-settings")).toHaveCount(0);
  });

  test("non-member info page 404s without leaking league existence", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });
    await signInTestUser(page, { userVariant: "B" });

    const { leagueId } = readCanonicalFixture();
    await page.goto(`/dashboard/leagues/${leagueId}`);

    await expect(page.getByRole("heading", { name: /^404$/ })).toBeVisible();
    await expect(
      page.getByTestId("resource-header-league").getByText(LEAGUES.NFL),
    ).toHaveCount(0);
  });
});

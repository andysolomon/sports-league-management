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
      page.getByRole("heading", { name: LEAGUES.NFL }),
    ).toBeVisible();
    await expect(page.getByText("Organization")).toBeVisible();
    await expect(page.getByText(/\d+ teams · \d+ seasons/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Seasons" }),
    ).toBeVisible();

    await expect(page.getByTestId("league-current-season")).toBeVisible();
    await expect(
      page.getByTestId("league-current-season").getByText("Current season"),
    ).toBeVisible();

    await expect(page.getByTestId("league-standings-card")).toBeVisible();
    await expect(
      page.getByTestId("league-standings-card").getByText("Standings"),
    ).toBeVisible();

    const teamsGrid = page.getByTestId("league-teams-grid");
    await expect(teamsGrid).toBeVisible();
    await expect(
      teamsGrid.getByRole("heading", { name: /Teams \(\d+\)/ }),
    ).toBeVisible();
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

    await page.getByRole("link", { name: "Manage" }).click();
    await expect(page).toHaveURL(`/dashboard/leagues/${leagueId}/manage`);
    await expect(page.getByTestId("league-manage-settings")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Make public|Make private/ }).first(),
    ).toBeVisible();
  });
});

test.describe("League manage access (WSM-000254)", () => {
  test("non-member cannot reach manage settings", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await signInTestUser(page, { userVariant: "B" });

    const { leagueId } = readCanonicalFixture();
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
      page.getByRole("heading", { name: LEAGUES.NFL }),
    ).toHaveCount(0);
  });
});

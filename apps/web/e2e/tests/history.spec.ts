import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedHistoryFixture,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";

/*
 * Record Book (D1, #630).
 *
 * Its own fixture league prevents completed-season history from leaking into
 * shared canonical specs. Both fixture Teams receive records so the per-Team
 * view is covered, not just the League tab.
 */
test.describe("League record book (D1)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "history-record-book";
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E History Home",
      awayTeamName: "E2E History Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
    await seedHistoryFixture(fixture);
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("renders League and both Team record-book views", async ({ page }) => {
    if (!fixture) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/leagues/${fixture.leagueId}/history`);
    const book = page.getByTestId("record-book");
    await expect(book).toBeVisible({ timeout: 30_000 });
    await expect(
      book.getByRole("heading", { name: "Record book", exact: true }),
    ).toBeVisible();
    await expect(book.getByText("Team wins", { exact: true })).toBeVisible();

    const views = book.getByTestId("record-book-views");
    await expect(
      views.getByRole("link", { name: "E2E History Home", exact: true }),
    ).toBeVisible();
    const away = views.getByRole("link", {
      name: "E2E History Away",
      exact: true,
    });
    await expect(away).toBeVisible();
    await away.click();

    await expect(
      book.getByText("E2E History Away records", { exact: true }),
    ).toBeVisible();
    await expect(book.getByText("8", { exact: true })).toBeVisible();
  });
});

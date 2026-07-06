import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "node:path";
import {
  withRosterFixture,
  getTestOrgId,
  getTestOrgIdB,
  type RosterFixtureResult,
} from "../helpers/seed-roster";
import { signInTestUser } from "../helpers/clerk-signin";
import {
  acceptBrowserConfirms,
  generateLeagueSyntheticData,
} from "../helpers/sim-league-setup";

/*
 * Manual SPRT rating edits (WSM-000121) — admin edit + persistence; cross-org
 * user cannot reach the player profile (no edit affordance).
 */
const FIXTURE_KEY = "ratings-edit";
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("SPRT ratings edit (WSM-000121)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withRosterFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      teamName: "E2E Ratings Team",
      rosterLimit: 53,
      seedActivePlayers: 1,
      extraBenchPlayers: 0,
      positionSlot: "QB",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
    await generateLeagueSyntheticData(page, fixture.leagueId);
    await context.close();
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
  });

  test("admin edits an attribute, saves, and value persists after reload", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const playerId = fixture!.playerIds[0];

    await page.goto(`/dashboard/players/${playerId}`);
    await expect(
      page.getByRole("heading", { name: /E2E Player 1/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "SPRT Rating" }),
    ).toBeVisible();

    const editBtn = page.getByRole("button", { name: "Edit SPRT ratings" });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Edit SPRT ratings")).toBeVisible();

    // Components render sorted by value (orderedComponents), so position is not
    // stable across an edit. Capture the edited input's aria-label and assert
    // that same labeled input after reload — not `.first()`.
    const firstInput = dialog.locator('input[type="number"]').first();
    const editedLabel = await firstInput.getAttribute("aria-label");
    expect(editedLabel).toBeTruthy();
    const prior = await firstInput.inputValue();
    const next = prior === "88" ? "87" : "88";
    await firstInput.fill(next);

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Ratings saved.")).toBeVisible();

    await page.reload();
    await editBtn.click();
    await expect(
      dialog.getByLabel(editedLabel!, { exact: true }),
    ).toHaveValue(next);
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("SPRT ratings edit — cross-org (WSM-000121)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgIdA = getTestOrgId();
    const orgIdB = getTestOrgIdB();
    test.skip(
      !orgIdA || !orgIdB,
      "E2E_CLERK_ORG_ID and E2E_CLERK_ORG_ID_B required.",
    );
    const handle = await withRosterFixture({
      fixtureKey: "ratings-edit-cross-org",
      clerkOrgId: orgIdA,
      teamName: "E2E Ratings Cross Org",
      rosterLimit: 53,
      seedActivePlayers: 1,
      extraBenchPlayers: 0,
      positionSlot: "QB",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    const context = await browser.newContext();
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
    await signInTestUser(page);
    await generateLeagueSyntheticData(page, fixture.leagueId);
    await context.close();
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await signInTestUser(page, { userVariant: "B" });
  });

  test("non-member cannot reach the player profile to edit ratings", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await page.goto(`/dashboard/players/${fixture!.playerIds[0]}`);
    await expect(page.getByRole("heading", { name: /^404$/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit SPRT ratings" }),
    ).toHaveCount(0);
  });
});

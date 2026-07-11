import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { getTestOrgId } from "../helpers/seed-roster";
import { pickSelectOption } from "../helpers/select";
import { TEAMS } from "../helpers/test-data";

/*
 * Schedules & standings (Phase 3 / WSM-000074) e2e smoke.
 *
 * Walks the admin's schedule loop end-to-end, then the public viewer:
 *   1. Admin opens /dashboard/leagues/[id]/schedule.
 *   2. Creates a fixture between two seeded teams via FixtureFormDialog.
 *   3. Opens RecordResultDialog, enters a final score.
 *   4. Standings page shows the winner with W=1 + matching PF.
 *   5. League starts private — public /leagues/[id]/standings 404s.
 *   6. Admin flips Make-public on the league detail page.
 *   7. Public standings + landing hub + game viewer render the result.
 *
 * Same runtime prerequisites as the player-attributes spec
 * (WSM-000064): CONVEX_ENABLE_E2E_SEED=1 on target Convex,
 * E2E_CLERK_USER_ID + E2E_CLERK_ORG_ID in the Playwright env.
 *
 * Rebuilt for #436 / WSM-000236: the dashboard schedule/standings pages head
 * with <h1>{league.name}</h1> and a context sub-line "Schedule/Standings ·
 * {season}" ("Season standings" is a CardTitle div, not a heading role), and
 * the StatusBadge renders the canonical capitalized label ("Final", not the
 * raw "final" status). The seeded league is named "E2E:{fixtureKey}" by the
 * Convex harness.
 *
 * This is deliberately ONE test, not a create/verify pair: on a test failure
 * Playwright restarts the worker for the retry, which re-runs beforeAll and
 * re-seeds a FRESH league — any later test that consumed state written by an
 * earlier one would find an empty league and fail unrelatedly. A single test
 * replays the whole flow against whatever beforeAll seeded, so retries stay
 * self-consistent.
 */
const FIXTURE_KEY = "schedules-standings-smoke";
const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;

test.describe("Schedules & standings — fixture loop (WSM-000074)", () => {
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E Home Hawks",
      awayTeamName: "E2E Away Owls",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("admin schedule loop: create fixture, record result, standings, public viewer", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const leagueId = fixture!.leagueId;

    // 1. Open the schedule page — headed by the league name, with the
    // "Schedule · {season}" subtitle confirming the active season resolved.
    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await expect(
      page.getByRole("heading", { name: LEAGUE_NAME }),
    ).toBeVisible();
    await expect(page.getByText("Schedule · E2E Season")).toBeVisible();

    // 2. Create a fixture.
    await page.getByRole("button", { name: "New fixture" }).click();
    const fixtureDialog = page.getByRole("dialog");
    await expect(fixtureDialog).toBeVisible();

    await pickSelectOption(page, "#fix-home", "E2E Home Hawks");
    await pickSelectOption(page, "#fix-away", "E2E Away Owls");
    await fixtureDialog.getByLabel("Week").fill("1");

    await fixtureDialog
      .getByRole("button", { name: "Create fixture" })
      .click();
    await expect(fixtureDialog).toBeHidden();

    // The new row appears in Week 1. Home/Away cells use exact team names;
    // action links use concise labels (Box score Home/Away, Live) instead.
    await expect(page.getByText("Week 1")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "E2E Home Hawks", exact: true }),
    ).toBeVisible();

    // 3. Record the result.
    await page.getByRole("button", { name: "Record result" }).click();
    const resultDialog = page.getByRole("dialog");
    await expect(resultDialog).toBeVisible();

    await resultDialog.getByLabel(/E2E Home Hawks/).fill("21");
    await resultDialog.getByLabel(/E2E Away Owls/).fill("10");
    await resultDialog.getByRole("button", { name: "Save result" }).click();
    await expect(resultDialog).toBeHidden();

    // The schedule row now shows 21 – 10 + the canonical Final badge.
    await expect(page.getByText("21 – 10")).toBeVisible();
    await expect(page.getByText("Final", { exact: true })).toBeVisible();

    // 4. Standings page reflects the result ("Season standings" is a
    // CardTitle div, so it's asserted as text, not a heading).
    await page.goto(`/dashboard/leagues/${leagueId}/standings`);
    await expect(
      page.getByRole("heading", { name: LEAGUE_NAME }),
    ).toBeVisible();
    await expect(page.getByText("Season standings")).toBeVisible();
    // Hawks row: 1 W, 21 PF, 10 PA, +11 differential.
    const hawksRow = page.locator("tr").filter({ hasText: "E2E Home Hawks" });
    await expect(hawksRow).toBeVisible();
    await expect(hawksRow).toContainText("21");
    await expect(hawksRow).toContainText("+11");

    // 5. Public viewers with a private league → 404 (standings + landing).
    // Public /leagues/* routes render fully server-side, so the HTTP status
    // is trustworthy here (unlike streamed /dashboard/* routes, WSM-000190).
    const privateResp = await page.goto(`/leagues/${leagueId}/standings`);
    expect(privateResp?.status()).toBe(404);
    const privateLanding = await page.goto(`/leagues/${leagueId}`);
    expect(privateLanding?.status()).toBe(404);

    // 6. Flip public via the admin toggle on the league detail page.
    await page.goto(`/dashboard/leagues/${leagueId}`);
    await page.getByRole("button", { name: /Make public/ }).click();
    await expect(
      page.getByRole("button", { name: /Make private/ }),
    ).toBeVisible();

    // 7a. Public route now renders the same standings table.
    await page.goto(`/leagues/${leagueId}/standings`);
    await expect(
      page.getByRole("heading", { name: "Standings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "E2E Home Hawks", exact: true }),
    ).toBeVisible();

    // 7b. Landing hub (WSM-000083) renders and links to the standings viewer.
    const publicLanding = await page.goto(`/leagues/${leagueId}`);
    expect(publicLanding?.ok()).toBe(true);
    await expect(
      page.getByRole("link", { name: /Standings/ }),
    ).toBeVisible();

    // 7c. Schedule section (WSM-000143) lists the game and links to its
    // public viewer; the viewer shows the final score for the matchup.
    const gameLink = page.getByRole("link", {
      name: /E2E Home Hawks vs E2E Away Owls/,
    });
    await expect(gameLink).toBeVisible();
    await gameLink.click();

    await expect(page).toHaveURL(/\/leagues\/[^/]+\/games\/[^/]+$/);
    await expect(
      page.getByRole("heading", {
        name: /E2E Home Hawks vs E2E Away Owls/,
      }),
    ).toBeVisible();
    await expect(page.getByText("Final", { exact: true })).toBeVisible();
  });
});

test.describe("Standings — division groups (canonical)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    const canonical = readCanonicalFixture();
    await setActiveLeague(page, canonical.leagueId);
  });

  test("division headers render and team names link to team pages", async ({
    page,
  }) => {
    const { leagueId } = readCanonicalFixture();

    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await page.getByRole("button", { name: "New fixture" }).click();
    const fixtureDialog = page.getByRole("dialog");
    await pickSelectOption(page, "#fix-home", TEAMS.COWBOYS.name);
    await pickSelectOption(page, "#fix-away", TEAMS.PATRIOTS.name);
    await fixtureDialog.getByLabel("Week").fill("1");
    await fixtureDialog
      .getByRole("button", { name: "Create fixture" })
      .click();
    await expect(fixtureDialog).toBeHidden();

    await page.getByRole("button", { name: "Record result" }).click();
    const resultDialog = page.getByRole("dialog");
    await resultDialog.getByLabel(/Dallas Cowboys/).fill("17");
    await resultDialog.getByLabel(/New England Patriots/).fill("14");
    await resultDialog.getByRole("button", { name: "Save result" }).click();
    await expect(resultDialog).toBeHidden();

    await page.goto(`/dashboard/leagues/${leagueId}/standings`);
    await expect(page.getByText("League Division", { exact: true })).toBeVisible();
    const cowboysLink = page.getByRole("link", {
      name: TEAMS.COWBOYS.name,
      exact: true,
    });
    await expect(cowboysLink).toBeVisible();
    await cowboysLink.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/teams/`));
    await expect(
      page.getByRole("heading", { name: TEAMS.COWBOYS.name }),
    ).toBeVisible();
  });
});

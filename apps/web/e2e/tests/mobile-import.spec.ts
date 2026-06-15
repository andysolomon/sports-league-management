import { test, expect, devices } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { signInTestUser } from "../helpers/clerk-signin";

/*
 * WSM-000085 (AC3): the Import flow must be fully tappable on a phone — the
 * file picker, the preview card's action buttons, and the result card's reset
 * button all need a >= 44px touch target. Buttons hit that via
 * `pointer-coarse:min-h-11` in ui/button.tsx, which only resolves under a
 * coarse primary pointer — so we emulate a real iPhone (setViewportSize alone
 * keeps a fine pointer and would not exercise the rule).
 *
 * The preview step is pure client state (FileReader -> setState), so uploading
 * a valid payload reaches it without any backend; we never click "Start
 * Import" (that would POST to /api/cli/import).
 */
test.use({ ...devices["iPhone 13"] });

const MIN_TOUCH_PX = 44;

// Minimal payload that satisfies LeagueImportSchema (league + >=1 division
// with >=1 team). Players omitted — the schema defaults them to [].
const VALID_IMPORT = JSON.stringify({
  league: { name: "E2E Mobile Import League" },
  divisions: [
    {
      name: "East",
      teams: [
        { name: "Test Team", city: "Testville", stadium: "Test Field" },
      ],
    },
  ],
});

test.describe("Mobile — import flow touch targets (WSM-000085)", () => {
  test.beforeAll(() => {
    test.skip(
      !process.env.E2E_CLERK_USER_ID || !process.env.CLERK_SECRET_KEY,
      "E2E_CLERK_USER_ID / CLERK_SECRET_KEY not set",
    );
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await signInTestUser(page);
    await page.goto("/dashboard/import");
    await page.waitForLoadState("networkidle");
  });

  test("dropzone is a large, tappable target", async ({ page }) => {
    const dropzone = page.getByLabel("Upload import file");
    await expect(dropzone).toBeVisible();
    const box = await dropzone.boundingBox();
    expect(box).not.toBeNull();
    // The dropzone is a generous p-8 region, well above the minimum.
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
  });

  test("preview action buttons meet the 44px touch target", async ({
    page,
  }) => {
    await page.getByLabel("Choose import file").setInputFiles({
      name: "league.json",
      mimeType: "application/json",
      buffer: Buffer.from(VALID_IMPORT),
    });

    // Preview card renders client-side once the file parses.
    const startImport = page.getByRole("button", { name: "Start Import" });
    await expect(startImport).toBeVisible();

    for (const name of ["Start Import", "Cancel"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box, `${name} button has no box`).not.toBeNull();
      expect(
        box!.height,
        `${name} button is ${box!.height}px tall (< ${MIN_TOUCH_PX}px touch target)`,
      ).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });
});

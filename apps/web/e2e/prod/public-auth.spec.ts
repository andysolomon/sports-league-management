import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Prod public auth smoke (WSM-000168). Signed-out flows only — no ticket sign-in.
 * Verifies marketing → sign-in navigation and that Clerk forms render on live prod.
 */
const SCREENSHOT_DIR = path.resolve("prod-screenshots", "public-auth");

test.describe("Prod public auth", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test("homepage Sign in link opens Clerk form", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: /Sign in to/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "homepage-to-sign-in.png"),
      fullPage: true,
    });
  });

  test("/sign-in renders Clerk form", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: /Sign in to/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "sign-in-direct.png"),
      fullPage: true,
    });
  });

  test("/sign-up renders Clerk form", async ({ page }) => {
    await page.goto("/sign-up", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: /Create your account/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "sign-up-direct.png"),
      fullPage: true,
    });
  });
});

import { test, expect } from "@playwright/test";

const DENSITY_KEY = "sports-mgmt-density";
const THEME_KEY = "theme";

test.describe("display settings persistence (WSM-000244)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("sports-mgmt-density");
      localStorage.removeItem("theme");
    });
  });

  test("theme and density survive reload without flash attributes", async ({
    page,
  }) => {
    // /local renders both DensityToggle and ThemeToggle without auth
    // (marketing `/` only exposes ThemeToggle).
    await page.goto("/local");

    const densityToggle = page.getByRole("button", {
      name: /compact density/i,
    });
    await expect(densityToggle).toBeVisible();
    await densityToggle.click();

    const themeToggle = page.getByRole("button", { name: /toggle theme/i });
    await themeToggle.click();

    await expect
      .poll(async () => page.evaluate(() => document.documentElement.className))
      .toMatch(/light/);
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-density")),
      )
      .toBe("compact");

    await page.reload();

    await expect
      .poll(async () => page.evaluate(() => document.documentElement.className))
      .toMatch(/light/);
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-density")),
      )
      .toBe("compact");

    const stored = await page.evaluate(
      ([densityKey, themeKey]) => ({
        density: localStorage.getItem(densityKey),
        theme: localStorage.getItem(themeKey),
      }),
      [DENSITY_KEY, THEME_KEY],
    );
    expect(stored.density).toBe("compact");
    expect(stored.theme).toBe("light");
  });
});

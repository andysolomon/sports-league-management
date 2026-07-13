import { test, expect } from "@playwright/test";

const DENSITY_KEY = "sports-mgmt-density";
const THEME_KEY = "theme";

async function resolvedTheme(page: {
  evaluate: <T>(fn: () => T) => Promise<T>;
}): Promise<"dark" | "light"> {
  return page.evaluate((): "dark" | "light" =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
}

test.describe("display settings persistence (WSM-000244)", () => {
  test("theme and density survive reload without flash attributes", async ({
    page,
  }) => {
    // Clear prefs once per tab. Do not use a bare addInitScript wipe — that
    // also runs on reload and would erase the values this test asserts.
    await page.addInitScript(() => {
      if (sessionStorage.getItem("__wsm244_prefs_cleared") === "1") return;
      localStorage.removeItem("sports-mgmt-density");
      localStorage.removeItem("theme");
      sessionStorage.setItem("__wsm244_prefs_cleared", "1");
    });

    // /local renders both DensityToggle and ThemeToggle without auth
    // (marketing `/` only exposes ThemeToggle).
    await page.goto("/local");

    const densityToggle = page.getByRole("button", {
      name: /compact density/i,
    });
    await expect(densityToggle).toBeVisible();
    await densityToggle.click();

    // next-themes with attribute="class" only adds/removes `dark` (no `light`
    // class). Toggle once from the system default, then assert that exact
    // resolved theme persists across reload.
    const themeToggle = page.getByRole("button", { name: /toggle theme/i });
    const beforeTheme = await resolvedTheme(page);
    await themeToggle.click();
    const expectedTheme = beforeTheme === "dark" ? "light" : "dark";

    await expect.poll(async () => resolvedTheme(page)).toBe(expectedTheme);
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-density")),
      )
      .toBe("compact");

    const storedBeforeReload = await page.evaluate(
      ([densityKey, themeKey]) => ({
        density: localStorage.getItem(densityKey),
        theme: localStorage.getItem(themeKey),
      }),
      [DENSITY_KEY, THEME_KEY],
    );
    expect(storedBeforeReload.density).toBe("compact");
    expect(storedBeforeReload.theme).toBe(expectedTheme);

    await page.reload();

    await expect.poll(async () => resolvedTheme(page)).toBe(expectedTheme);
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
    expect(stored.theme).toBe(expectedTheme);
  });
});

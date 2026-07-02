import type { Page } from "@playwright/test";

/**
 * Drive a Radix/shadcn <Select> (WSM-000119 pick lists): the trigger is a
 * combobox button, not an <input>, so .fill()/.clear() don't work. Click the
 * trigger, then click the option in the portalled listbox. `exact` matching
 * keeps short option names from colliding ("C" vs "CB", "Dallas" vs
 * "Lake Dallas"). The option click auto-waits, which also covers selects
 * whose option lists stream in after open (e.g. the lazy-loaded city list).
 */
export async function pickSelectOption(
  page: Page,
  triggerSelector: string,
  optionName: string,
): Promise<void> {
  await page.locator(triggerSelector).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

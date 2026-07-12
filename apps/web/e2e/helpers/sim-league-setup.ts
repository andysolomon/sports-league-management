/**
 * UI bootstrap for sim / playoffs / dynasty e2e specs (WSM-000183+).
 *
 * Builds on `withScheduleFixture` (two seeded teams) by adding teams, synthetic
 * rosters + ratings, optional playoff config, and a single round-robin slate
 * — all through the same admin surfaces production uses.
 */
import { expect, type Page } from "@playwright/test";

export const E2E_SEASON_NAME = "E2E Season";

/** Auto-accept `window.confirm` prompts from sim / synthetic / playoff actions. */
export function acceptBrowserConfirms(page: Page): void {
  const tagged = page as Page & { __acceptsDialogs?: boolean };
  if (tagged.__acceptsDialogs) return;
  tagged.__acceptsDialogs = true;
  page.on("dialog", (dialog) => void dialog.accept());
}

/**
 * Confirm an in-app ActionConfirmDialog (lifecycle surfaces from PR #535).
 * Pass `expectClose: false` for paths where confirming does NOT close the
 * dialog (error-retry states, or flows that chain into a second dialog).
 * Pass `name` (the dialog's accessible name = its title) when more than one
 * ActionConfirmDialog can be mounted at once — e.g. season completion without
 * a champion keeps the first dialog in the DOM while the force-completion
 * dialog opens, so the bare testid locator hits a strict-mode violation.
 */
export async function confirmLifecycleDialog(
  page: Page,
  opts: { expectClose?: boolean; name?: string | RegExp } = {},
): Promise<void> {
  const dialog = opts.name
    ? page.getByRole("alertdialog", { name: opts.name })
    : page.getByTestId("action-confirm-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("action-confirm-submit").click();
  if (opts.expectClose !== false) {
    await expect(dialog).toBeHidden();
  }
}

export async function addTeamsToLeague(
  page: Page,
  leagueId: string,
  names: string[],
): Promise<void> {
  await page.goto(`/dashboard/leagues/${leagueId}`);
  for (const name of names) {
    await page.getByRole("button", { name: "Add team" }).click();
    await page.getByPlaceholder("Team name").fill(name);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(`Added ${name}.`)).toBeVisible({
      timeout: 30_000,
    });
  }
}

export async function configureSeasonPlayoffs(
  page: Page,
  leagueName: string,
  playoffTeams: number,
): Promise<void> {
  await page.goto(`/dashboard/seasons`);
  const card = page.locator('[data-slot="card"]', { hasText: leagueName });
  const row = card.locator("li", { hasText: E2E_SEASON_NAME });
  await row.getByRole("button", { name: `Edit ${E2E_SEASON_NAME}` }).click();
  await row.getByLabel("Number of playoff teams").selectOption(
    String(playoffTeams),
  );
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Season updated.")).toBeVisible({
    timeout: 30_000,
  });
}

export async function generateLeagueSyntheticData(
  page: Page,
  leagueId: string,
): Promise<void> {
  await page.goto(`/dashboard/leagues/${leagueId}`);
  const rostersBtn = page.getByRole("button", { name: "Generate rosters" });
  await rostersBtn.click();
  await confirmLifecycleDialog(page);
  await expect(rostersBtn).toBeEnabled({ timeout: 120_000 });
  const ratingsBtn = page.getByRole("button", { name: "Generate ratings" });
  await ratingsBtn.click();
  await confirmLifecycleDialog(page);
  await expect(ratingsBtn).toBeEnabled({ timeout: 120_000 });
}

export async function generateRoundRobinSchedule(
  page: Page,
  leagueId: string,
): Promise<void> {
  await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
  const generate = page.getByRole("button", { name: /Generate schedule/ });
  await expect(generate).toBeVisible();
  // Fresh leagues have no fixtures — GenerateScheduleButton skips the dialog.
  await generate.click();
  await expect(page.getByText("Week 1", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
}

export function weekCard(page: Page, week: number) {
  return page.locator('[data-slot="card"]').filter({
    has: page.getByText(`Week ${week}`, { exact: true }),
  });
}

export async function bootstrapFourTeamSimLeague(
  page: Page,
  leagueId: string,
  leagueName: string,
  opts?: { playoffTeams?: number },
): Promise<void> {
  await addTeamsToLeague(page, leagueId, ["E2E Team C", "E2E Team D"]);
  if (opts?.playoffTeams != null) {
    await configureSeasonPlayoffs(page, leagueName, opts.playoffTeams);
  }
  await generateLeagueSyntheticData(page, leagueId);
  await generateRoundRobinSchedule(page, leagueId);
}

export async function openSimulateScopeMenu(page: Page) {
  // The scope trigger is the only button named exactly "Simulate" — per-game
  // buttons use aria-label "Simulate <home> vs <away>". Its dropdown-trigger
  // data-slot sits ON this button (Radix asChild), not on a descendant, so a
  // `.filter({ has: ... })` for that slot matches nothing.
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
}

export async function simWeek(page: Page, week: number) {
  await weekCard(page, week)
    .getByRole("button", { name: "Sim week" })
    .click();
  await confirmLifecycleDialog(page);
}

export async function simRegularSeason(page: Page) {
  await openSimulateScopeMenu(page);
  await page.getByRole("menuitem", { name: "Sim regular season" }).click();
  await confirmLifecycleDialog(page);
  await expect(
    page.getByText(/Simulated \d+ regular-season game/),
  ).toBeVisible({ timeout: 120_000 });
}

export async function simPlayoffsScope(
  page: Page,
  opts: { expectClose?: boolean } = {},
) {
  await openSimulateScopeMenu(page);
  await page.getByRole("menuitem", { name: "Sim playoffs" }).click();
  await confirmLifecycleDialog(page, opts);
}

export async function simToChampion(page: Page) {
  await openSimulateScopeMenu(page);
  await page.getByRole("menuitem", { name: "Sim to champion" }).click();
  await confirmLifecycleDialog(page);
  await expect(page.getByText(/wins — simulated/)).toBeVisible({
    timeout: 180_000,
  });
}

export async function advanceToPlayoffs(page: Page) {
  await page.getByRole("button", { name: "Advance to playoffs" }).click();
  await confirmLifecycleDialog(page);
}

export async function completeSeason(
  page: Page,
  seasonId: string,
  opts: { forceWithoutChampion?: boolean } = {},
) {
  await page.goto("/dashboard/seasons");
  const seasonRow = page.locator("li").filter({
    has: page.locator(`a[href="/dashboard/seasons/${seasonId}"]`),
  });
  await seasonRow.getByRole("button", { name: /^Complete / }).click();
  if (opts.forceWithoutChampion) {
    // No playoff champion: confirming "Complete <season>?" opens a second
    // "Complete without a champion?" force-completion dialog instead of
    // closing. Name-scope both confirms (both dialogs share the testid).
    await confirmLifecycleDialog(page, {
      name: /^Complete (?!without a champion\?)/,
      expectClose: false,
    });
    await confirmLifecycleDialog(page, {
      name: "Complete without a champion?",
    });
  } else {
    await confirmLifecycleDialog(page);
  }
  await expect(page.getByText(/completed\./)).toBeVisible({ timeout: 60_000 });
}

export async function startNextSeason(page: Page) {
  await page.getByRole("button", { name: "Start next season" }).click();
  await confirmLifecycleDialog(page);
}

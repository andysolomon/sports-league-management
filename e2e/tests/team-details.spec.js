/**
 * Team Details — E2E Tests
 *
 * Tests team details page load, selection, and field display.
 */

import { test, expect } from '@playwright/test';
import { authenticateViaSf, loginViaFrontdoor, navigateToApp, navigateToTab } from '../helpers/salesforce.js';
import { TEAMS } from '../helpers/test-data.js';

const ORG_ALIAS = process.env.SF_ORG_ALIAS || 'sports-scratch';

test.describe('Team Details', () => {
  let instanceUrl;
  let accessToken;

  test.beforeEach(async ({ page }) => {
    ({ instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS));
    await loginViaFrontdoor(page, instanceUrl, accessToken);
    await navigateToApp(page, instanceUrl);
    await navigateToTab(page, 'Team Details');
  });

  test('page loads with team selector', async ({ page }) => {
    // The team details component should show a team selector dropdown
    const selector = page.locator('c-team-details select#team-selector, c-team-details lightning-combobox');
    await expect(selector.first()).toBeVisible({ timeout: 15000 });
  });

  test('select team and verify detail fields', async ({ page }) => {
    // Wait for teams to load
    await page.waitForTimeout(2000);

    // Select Dallas Cowboys from the dropdown
    const selector = page.locator('c-team-details select#team-selector');

    if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
      // HTML select element
      await selector.selectOption({ label: TEAMS.COWBOYS.name });
    } else {
      // Lightning combobox fallback
      const combobox = page.locator('c-team-details lightning-combobox');
      await combobox.click();
      const option = page.locator('lightning-base-combobox-item', { hasText: TEAMS.COWBOYS.name });
      await option.first().click();
    }

    await page.waitForTimeout(2000);

    // Verify detail fields are displayed
    const teamDetails = page.locator('c-team-details');
    await expect(teamDetails).toContainText(TEAMS.COWBOYS.name, { timeout: 10000 });
    await expect(teamDetails).toContainText(TEAMS.COWBOYS.city);
    await expect(teamDetails).toContainText(TEAMS.COWBOYS.stadium);
    await expect(teamDetails).toContainText(String(TEAMS.COWBOYS.foundedYear));
  });

  test('select different team and verify fields update', async ({ page }) => {
    await page.waitForTimeout(2000);

    const selector = page.locator('c-team-details select#team-selector');

    if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selector.selectOption({ label: TEAMS.GALAXY.name });
    } else {
      const combobox = page.locator('c-team-details lightning-combobox');
      await combobox.click();
      const option = page.locator('lightning-base-combobox-item', { hasText: TEAMS.GALAXY.name });
      await option.first().click();
    }

    await page.waitForTimeout(2000);

    const teamDetails = page.locator('c-team-details');
    await expect(teamDetails).toContainText(TEAMS.GALAXY.name, { timeout: 10000 });
    await expect(teamDetails).toContainText(TEAMS.GALAXY.city);
    await expect(teamDetails).toContainText(TEAMS.GALAXY.stadium);
  });
});

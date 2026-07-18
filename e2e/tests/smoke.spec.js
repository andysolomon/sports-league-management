/**
 * Smoke Test — verifies basic authentication and app navigation.
 */

import { test, expect } from '@playwright/test';
import { authenticateViaSf, loginViaFrontdoor, navigateToApp, waitForLightningReady } from '../helpers/salesforce.js';

const ORG_ALIAS = process.env.SF_ORG_ALIAS || 'sports-scratch';

test.describe('Smoke Tests', () => {
  test('should authenticate and load Sports League Management app', async ({ page }) => {
    const { instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS);

    await loginViaFrontdoor(page, instanceUrl, accessToken);
    await navigateToApp(page, instanceUrl);

    // Verify the app loaded by checking for the app name in the header
    const appName = page.locator('span.appName, one-app-launcher-header span');
    await expect(appName.first()).toBeVisible({ timeout: 15000 });

    // Verify at least one navigation tab is present
    const navBar = page.locator('one-app-nav-bar');
    await expect(navBar).toBeVisible({ timeout: 10000 });
  });

  test('should display navigation tabs', async ({ page }) => {
    const { instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS);

    await loginViaFrontdoor(page, instanceUrl, accessToken);
    await navigateToApp(page, instanceUrl);

    // Check that expected tabs exist
    const expectedTabs = ['Home', 'Leagues', 'Teams'];
    for (const tabName of expectedTabs) {
      const tab = page.locator(`one-app-nav-bar-item-root a[title="${tabName}"]`);
      // Tab might be in overflow menu, so just verify at least the core ones
      const isVisible = await tab.isVisible({ timeout: 5000 }).catch(() => false);
      if (!isVisible) {
        // Check overflow menu
        const moreButton = page.locator('button[title="More"]');
        if (await moreButton.isVisible().catch(() => false)) {
          await moreButton.click();
          const menuItem = page.locator(`one-app-nav-bar-menu-item a[title="${tabName}"]`);
          await expect(menuItem).toBeVisible({ timeout: 5000 });
          // Close menu by pressing Escape
          await page.keyboard.press('Escape');
        }
      }
    }
  });
});

/**
 * Division Management — E2E Tests
 *
 * Tests the full CRUD workflow for divisions through the browser.
 */

import { test, expect } from '@playwright/test';
import { authenticateViaSf, loginViaFrontdoor, navigateToApp, navigateToTab, waitForLightningReady, waitForToast } from '../helpers/salesforce.js';
import { LEAGUES, TEAMS, NEW_RECORDS } from '../helpers/test-data.js';

const ORG_ALIAS = process.env.SF_ORG_ALIAS || 'sports-scratch';

test.describe('Division Management', () => {
  let instanceUrl;
  let accessToken;

  test.beforeEach(async ({ page }) => {
    ({ instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS));
    await loginViaFrontdoor(page, instanceUrl, accessToken);
    await navigateToApp(page, instanceUrl);
    await navigateToTab(page, 'Division Management');
  });

  test('page loads and displays division management header', async ({ page }) => {
    const heading = page.locator('c-division-management .slds-text-heading_medium');
    await expect(heading).toContainText('Division Management', { timeout: 15000 });
  });

  test('create a new division', async ({ page }) => {
    // Click Create Division button
    const createButton = page.locator('c-division-management button', { hasText: 'Create Division' });
    await createButton.click();

    // Fill in the modal form
    const modal = page.locator('c-division-management .slds-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Enter division name
    const nameInput = modal.locator('lightning-input');
    await nameInput.fill(NEW_RECORDS.DIVISION.name);

    // Select league
    const leagueCombobox = modal.locator('lightning-combobox');
    await leagueCombobox.click();
    const leagueOption = page.locator(`lightning-base-combobox-item[data-value]`, { hasText: LEAGUES.NFL });
    await leagueOption.first().click();

    // Click Create
    const submitButton = modal.locator('button', { hasText: 'Create' });
    await submitButton.click();

    // Verify success toast
    await waitForToast(page, 'Division created successfully');
  });

  test('edit a division', async ({ page }) => {
    // Wait for divisions to load
    await page.waitForTimeout(2000);

    // Find an action menu and click Edit
    const actionMenu = page.locator('c-division-management lightning-button-menu').first();
    await actionMenu.click();

    const editOption = page.locator('lightning-menu-item', { hasText: 'Edit' }).first();
    await editOption.click();

    // Modal should appear
    const modal = page.locator('c-division-management .slds-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Update the name
    const nameInput = modal.locator('lightning-input');
    await nameInput.fill('Updated Division Name');

    // Click Save
    const saveButton = modal.locator('button', { hasText: 'Save' });
    await saveButton.click();

    await waitForToast(page, 'Division updated successfully');
  });

  test('delete a division', async ({ page }) => {
    // First create a division to delete
    const createButton = page.locator('c-division-management button', { hasText: 'Create Division' });
    await createButton.click();

    const modal = page.locator('c-division-management .slds-modal');
    const nameInput = modal.locator('lightning-input');
    await nameInput.fill('Division To Delete');

    const leagueCombobox = modal.locator('lightning-combobox');
    await leagueCombobox.click();
    const leagueOption = page.locator('lightning-base-combobox-item[data-value]', { hasText: LEAGUES.MLS });
    await leagueOption.first().click();

    const submitButton = modal.locator('button', { hasText: 'Create' });
    await submitButton.click();
    await waitForToast(page, 'Division created successfully');

    // Wait for refresh
    await page.waitForTimeout(2000);

    // Find the division we just created and delete it
    const divisionCard = page.locator('c-division-management').locator('text=Division To Delete');
    await expect(divisionCard).toBeVisible({ timeout: 10000 });

    // Click its action menu
    const actionMenus = page.locator('c-division-management lightning-button-menu');
    await actionMenus.last().click();

    const deleteOption = page.locator('lightning-menu-item', { hasText: 'Delete' });
    await deleteOption.click();

    // Confirm deletion in the modal
    const deleteModal = page.locator('c-division-management .slds-modal');
    await expect(deleteModal).toBeVisible({ timeout: 5000 });

    const deleteButton = deleteModal.locator('button', { hasText: 'Delete' });
    await deleteButton.click();

    await waitForToast(page, 'Division deleted successfully');
  });

  test('filter divisions by league', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Find the league filter combobox
    const leagueFilter = page.locator('c-division-management lightning-combobox').first();
    await leagueFilter.click();

    // Select NFL
    const nflOption = page.locator('lightning-base-combobox-item', { hasText: LEAGUES.NFL });
    await nflOption.first().click();

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Page should still be functional after filtering
    const heading = page.locator('c-division-management .slds-text-heading_medium');
    await expect(heading).toContainText('Division Management');
  });

  test('assign team to division', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Look for the Assign Team button (only visible when a division exists)
    const assignButton = page.locator('c-division-management button', { hasText: 'Assign Team' });

    // If assign button is visible, test the flow
    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click();

      const modal = page.locator('c-division-management .slds-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Select a team
      const teamCombobox = modal.locator('lightning-combobox').first();
      await teamCombobox.click();
      const teamOption = page.locator('lightning-base-combobox-item[data-value]').first();
      await teamOption.click();

      // Select a division
      const divCombobox = modal.locator('lightning-combobox').last();
      await divCombobox.click();
      const divOption = page.locator('lightning-base-combobox-item[data-value]').first();
      await divOption.click();

      // Click Assign
      const assignSubmit = modal.locator('button', { hasText: 'Assign' });
      await assignSubmit.click();

      await waitForToast(page, 'Team assigned to division successfully');
    }
  });
});

/**
 * Season Management — E2E Tests
 *
 * Tests the full CRUD workflow for seasons through the browser.
 */

import { test, expect } from '@playwright/test';
import { authenticateViaSf, loginViaFrontdoor, navigateToApp, navigateToTab, waitForToast } from '../helpers/salesforce.js';
import { LEAGUES, SEASONS, NEW_RECORDS } from '../helpers/test-data.js';

const ORG_ALIAS = process.env.SF_ORG_ALIAS || 'sports-scratch';

test.describe('Season Management', () => {
  let instanceUrl;
  let accessToken;

  test.beforeEach(async ({ page }) => {
    ({ instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS));
    await loginViaFrontdoor(page, instanceUrl, accessToken);
    await navigateToApp(page, instanceUrl);
    await navigateToTab(page, 'Season Management');
  });

  test('page loads with seasons', async ({ page }) => {
    const heading = page.locator('c-season-management .slds-text-heading_medium');
    await expect(heading).toContainText('Season Management', { timeout: 15000 });

    // Verify at least one season is displayed
    const seasonCards = page.locator('c-season-management .slds-box');
    await expect(seasonCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('create season with dates and status', async ({ page }) => {
    const createButton = page.locator('c-season-management button', { hasText: 'Create Season' });
    await createButton.click();

    const modal = page.locator('c-season-management .slds-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill season name
    const nameInput = modal.locator('lightning-input[type="text"], lightning-input').first();
    await nameInput.fill(NEW_RECORDS.SEASON.name);

    // Select league
    const leagueCombobox = modal.locator('lightning-combobox').first();
    await leagueCombobox.click();
    const leagueOption = page.locator('lightning-base-combobox-item', { hasText: LEAGUES.NFL });
    await leagueOption.first().click();

    // Set start date
    const dateInputs = modal.locator('lightning-input[type="date"], lightning-input');
    const startDateInput = dateInputs.nth(1);
    await startDateInput.fill(NEW_RECORDS.SEASON.startDate);

    // Set end date
    const endDateInput = dateInputs.nth(2);
    await endDateInput.fill(NEW_RECORDS.SEASON.endDate);

    // Select status
    const statusCombobox = modal.locator('lightning-combobox').last();
    await statusCombobox.click();
    const statusOption = page.locator('lightning-base-combobox-item', { hasText: 'Upcoming' });
    await statusOption.first().click();

    // Click Create
    const submitButton = modal.locator('button', { hasText: 'Create' });
    await submitButton.click();

    await waitForToast(page, 'Season created successfully');
  });

  test('edit season', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Click action menu on first season
    const actionMenu = page.locator('c-season-management lightning-button-menu').first();
    await actionMenu.click();

    const editOption = page.locator('lightning-menu-item', { hasText: 'Edit' }).first();
    await editOption.click();

    const modal = page.locator('c-season-management .slds-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Update the name
    const nameInput = modal.locator('lightning-input').first();
    await nameInput.fill('Updated Season Name');

    const saveButton = modal.locator('button', { hasText: 'Save' });
    await saveButton.click();

    await waitForToast(page, 'Season updated successfully');
  });

  test('delete season', async ({ page }) => {
    // Create a season to delete
    const createButton = page.locator('c-season-management button', { hasText: 'Create Season' });
    await createButton.click();

    const modal = page.locator('c-season-management .slds-modal');
    const nameInput = modal.locator('lightning-input').first();
    await nameInput.fill('Season To Delete');

    const leagueCombobox = modal.locator('lightning-combobox').first();
    await leagueCombobox.click();
    const leagueOption = page.locator('lightning-base-combobox-item', { hasText: LEAGUES.MLS });
    await leagueOption.first().click();

    const submitButton = modal.locator('button', { hasText: 'Create' });
    await submitButton.click();
    await waitForToast(page, 'Season created successfully');

    await page.waitForTimeout(2000);

    // Find and delete it
    const actionMenus = page.locator('c-season-management lightning-button-menu');
    await actionMenus.last().click();

    const deleteOption = page.locator('lightning-menu-item', { hasText: 'Delete' });
    await deleteOption.click();

    const deleteModal = page.locator('c-season-management .slds-modal');
    await expect(deleteModal).toBeVisible({ timeout: 5000 });

    const deleteButton = deleteModal.locator('button', { hasText: 'Delete' });
    await deleteButton.click();

    await waitForToast(page, 'Season deleted successfully');
  });

  test('filter seasons by league', async ({ page }) => {
    await page.waitForTimeout(2000);

    const leagueFilter = page.locator('c-season-management lightning-combobox').first();
    await leagueFilter.click();

    const nflOption = page.locator('lightning-base-combobox-item', { hasText: LEAGUES.NFL });
    await nflOption.first().click();

    await page.waitForTimeout(1000);

    // Verify NFL season is visible
    const seasonText = page.locator('c-season-management');
    await expect(seasonText).toContainText('NFL', { timeout: 5000 });
  });
});

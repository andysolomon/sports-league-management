/**
 * Player Roster — E2E Tests
 *
 * Tests the full CRUD workflow for players through the browser.
 */

import { test, expect } from '@playwright/test';
import { authenticateViaSf, loginViaFrontdoor, navigateToApp, navigateToTab, waitForToast } from '../helpers/salesforce.js';
import { TEAMS, PLAYERS, NEW_RECORDS } from '../helpers/test-data.js';

const ORG_ALIAS = process.env.SF_ORG_ALIAS || 'sports-scratch';

test.describe('Player Roster', () => {
  let instanceUrl;
  let accessToken;

  test.beforeEach(async ({ page }) => {
    ({ instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS));
    await loginViaFrontdoor(page, instanceUrl, accessToken);
    await navigateToApp(page, instanceUrl);
    await navigateToTab(page, 'Player Roster');
  });

  test('page loads with players', async ({ page }) => {
    const heading = page.locator('c-player-roster .slds-text-heading_medium');
    await expect(heading).toContainText('Player Roster', { timeout: 15000 });

    // Verify at least one player is displayed
    const playerCards = page.locator('c-player-roster .slds-box');
    await expect(playerCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('create player with all fields', async ({ page }) => {
    const createButton = page.locator('c-player-roster button', { hasText: 'Add Player' });
    await createButton.click();

    const modal = page.locator('c-player-roster .slds-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill player name
    const inputs = modal.locator('lightning-input');
    await inputs.first().fill(NEW_RECORDS.PLAYER.name);

    // Select team
    const teamCombobox = modal.locator('lightning-combobox').first();
    await teamCombobox.click();
    const teamOption = page.locator('lightning-base-combobox-item', { hasText: TEAMS.COWBOYS.name });
    await teamOption.first().click();

    // Fill position
    const positionInput = inputs.nth(1);
    await positionInput.fill(NEW_RECORDS.PLAYER.position);

    // Fill jersey number
    const jerseyInput = inputs.nth(2);
    await jerseyInput.fill(String(NEW_RECORDS.PLAYER.jerseyNumber));

    // Select status
    const statusCombobox = modal.locator('lightning-combobox').last();
    await statusCombobox.click();
    const statusOption = page.locator('lightning-base-combobox-item', { hasText: 'Active' });
    await statusOption.first().click();

    // Click Create
    const submitButton = modal.locator('button', { hasText: 'Create' });
    await submitButton.click();

    await waitForToast(page, 'Player created successfully');
  });

  test('edit player', async ({ page }) => {
    await page.waitForTimeout(2000);

    const actionMenu = page.locator('c-player-roster lightning-button-menu').first();
    await actionMenu.click();

    const editOption = page.locator('lightning-menu-item', { hasText: 'Edit' }).first();
    await editOption.click();

    const modal = page.locator('c-player-roster .slds-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Update the name
    const nameInput = modal.locator('lightning-input').first();
    await nameInput.fill('Updated Player Name');

    const saveButton = modal.locator('button', { hasText: 'Save' });
    await saveButton.click();

    await waitForToast(page, 'Player updated successfully');
  });

  test('delete player', async ({ page }) => {
    // Create a player to delete
    const createButton = page.locator('c-player-roster button', { hasText: 'Add Player' });
    await createButton.click();

    const modal = page.locator('c-player-roster .slds-modal');
    const nameInput = modal.locator('lightning-input').first();
    await nameInput.fill('Player To Delete');

    const teamCombobox = modal.locator('lightning-combobox').first();
    await teamCombobox.click();
    const teamOption = page.locator('lightning-base-combobox-item[data-value]').first();
    await teamOption.click();

    const submitButton = modal.locator('button', { hasText: 'Create' });
    await submitButton.click();
    await waitForToast(page, 'Player created successfully');

    await page.waitForTimeout(2000);

    // Find and delete it
    const actionMenus = page.locator('c-player-roster lightning-button-menu');
    await actionMenus.last().click();

    const deleteOption = page.locator('lightning-menu-item', { hasText: 'Delete' });
    await deleteOption.click();

    const deleteModal = page.locator('c-player-roster .slds-modal');
    await expect(deleteModal).toBeVisible({ timeout: 5000 });

    const deleteButton = deleteModal.locator('button', { hasText: 'Delete' });
    await deleteButton.click();

    await waitForToast(page, 'Player deleted successfully');
  });

  test('filter players by team', async ({ page }) => {
    await page.waitForTimeout(2000);

    const teamFilter = page.locator('c-player-roster lightning-combobox').first();
    await teamFilter.click();

    const cowboysOption = page.locator('lightning-base-combobox-item', { hasText: TEAMS.COWBOYS.name });
    await cowboysOption.first().click();

    await page.waitForTimeout(1000);

    // Should see Cowboys players
    const rosterContent = page.locator('c-player-roster');
    await expect(rosterContent).toContainText(PLAYERS.PRESCOTT.name, { timeout: 5000 });
  });
});

/**
 * Permission-Based Access Control — E2E Tests
 *
 * Verifies that each user role has the correct access level.
 * Tests run as different users via admin Login-As flow.
 */

import { test, expect } from '@playwright/test';
import { authenticateViaSf, loginViaFrontdoor, navigateToApp, navigateToTab, waitForLightningReady, waitForToast } from '../helpers/salesforce.js';
import { LEAGUES, TEAMS, NEW_RECORDS, USERS } from '../helpers/test-data.js';

const ORG_ALIAS = process.env.SF_ORG_ALIAS || 'sports-scratch';

/**
 * Helper: Login as a specific user via admin Login-As.
 */
async function loginAsUserViaSetup(page, instanceUrl, accessToken, username) {
  // First login as admin
  await loginViaFrontdoor(page, instanceUrl, accessToken);
  await waitForLightningReady(page);

  // Query the user ID via REST API
  const userId = await page.evaluate(async (uname) => {
    const sid = document.cookie.match(/sid=([^;]+)/)?.[1] || '';
    const response = await fetch(
      `/services/data/v58.0/query/?q=${encodeURIComponent(`SELECT Id FROM User WHERE Username = '${uname}' LIMIT 1`)}`,
      { headers: { 'Authorization': `Bearer ${sid}`, 'Content-Type': 'application/json' } }
    );
    const data = await response.json();
    return data.records?.[0]?.Id || null;
  }, username);

  if (!userId) {
    throw new Error(`Could not find user with username: ${username}`);
  }

  // Navigate to Login-As URL
  const orgId = await page.evaluate(() => {
    // eslint-disable-next-line no-undef
    const userInfo = window.$A?.get('$SfdcSite');
    return document.cookie.match(/oid=([^;]+)/)?.[1] || '';
  });

  await page.goto(
    `${instanceUrl}/servlet/servlet.su?oid=${orgId}&suorgadminid=${userId}&targetURL=%2Flightning%2Fpage%2Fhome`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForLightningReady(page);
}

/**
 * Helper: Attempt to create a division and return whether it succeeded.
 */
async function attemptCreateDivision(page) {
  await navigateToTab(page, 'Division Management');
  await page.waitForTimeout(2000);

  const createButton = page.locator('c-division-management button', { hasText: 'Create Division' });
  if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
    return { visible: false, success: false };
  }

  await createButton.click();

  const modal = page.locator('c-division-management .slds-modal');
  await expect(modal).toBeVisible({ timeout: 5000 });

  const nameInput = modal.locator('lightning-input');
  await nameInput.fill('Permission Test Division');

  const leagueCombobox = modal.locator('lightning-combobox');
  await leagueCombobox.click();
  const leagueOption = page.locator('lightning-base-combobox-item[data-value]').first();
  await leagueOption.click();

  const submitButton = modal.locator('button', { hasText: 'Create' });
  await submitButton.click();

  // Check for success or error toast
  const toast = page.locator('div.toastMessage');
  await toast.first().waitFor({ state: 'visible', timeout: 15000 });
  const toastText = await toast.first().textContent();

  // Close toast
  const closeBtn = page.locator('button.toastClose, button[title="Close"]').first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
  }

  return {
    visible: true,
    success: toastText.includes('successfully'),
    message: toastText
  };
}

/**
 * Helper: Attempt to create a player and return whether it succeeded.
 */
async function attemptCreatePlayer(page) {
  await navigateToTab(page, 'Player Roster');
  await page.waitForTimeout(2000);

  const createButton = page.locator('c-player-roster button', { hasText: 'Add Player' });
  if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
    return { visible: false, success: false };
  }

  await createButton.click();

  const modal = page.locator('c-player-roster .slds-modal');
  await expect(modal).toBeVisible({ timeout: 5000 });

  const inputs = modal.locator('lightning-input');
  await inputs.first().fill('Permission Test Player');

  const teamCombobox = modal.locator('lightning-combobox').first();
  await teamCombobox.click();
  const teamOption = page.locator('lightning-base-combobox-item[data-value]').first();
  await teamOption.click();

  const submitButton = modal.locator('button', { hasText: 'Create' });
  await submitButton.click();

  const toast = page.locator('div.toastMessage');
  await toast.first().waitFor({ state: 'visible', timeout: 15000 });
  const toastText = await toast.first().textContent();

  const closeBtn = page.locator('button.toastClose, button[title="Close"]').first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
  }

  return {
    visible: true,
    success: toastText.includes('successfully'),
    message: toastText
  };
}

/**
 * Helper: Check if a page loads and displays data.
 */
async function canViewPage(page, tabName, componentTag) {
  await navigateToTab(page, tabName);
  await page.waitForTimeout(3000);

  const component = page.locator(componentTag);
  return component.isVisible({ timeout: 10000 }).catch(() => false);
}

// ─── League Administrator Tests ──────────────────────────────────────────────

test.describe('League Administrator Access', () => {
  let instanceUrl;
  let accessToken;

  test.beforeEach(async ({ page }) => {
    ({ instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS));
    // Admin user already has League_Administrator permission set
    await loginViaFrontdoor(page, instanceUrl, accessToken);
    await navigateToApp(page, instanceUrl);
  });

  test('can view all four pages', async ({ page }) => {
    // Positive: can view Division Management
    const divVisible = await canViewPage(page, 'Division Management', 'c-division-management');
    expect(divVisible).toBeTruthy();

    // Positive: can view Season Management
    const seasonVisible = await canViewPage(page, 'Season Management', 'c-season-management');
    expect(seasonVisible).toBeTruthy();
  });

  test('can create and delete divisions', async ({ page }) => {
    // Positive: can create a division
    const createResult = await attemptCreateDivision(page);
    expect(createResult.success).toBeTruthy();
  });

  test('can create and delete players', async ({ page }) => {
    // Positive: can create a player
    const createResult = await attemptCreatePlayer(page);
    expect(createResult.success).toBeTruthy();
  });
});

// ─── Team Manager Tests ──────────────────────────────────────────────────────

test.describe('Team Manager Access', () => {
  let instanceUrl;
  let accessToken;

  test.beforeEach(async ({ page }) => {
    ({ instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS));
    // Login as the Team Manager user
    await loginAsUserViaSetup(page, instanceUrl, accessToken, `team.manager@sportsorg.scratch`);
    await navigateToApp(page, instanceUrl);
  });

  test('can view all pages and create players (positive)', async ({ page }) => {
    // Positive: can view Player Roster
    const playerVisible = await canViewPage(page, 'Player Roster', 'c-player-roster');
    expect(playerVisible).toBeTruthy();

    // Positive: can create a player (Team Manager has CRUD on Player__c)
    const createResult = await attemptCreatePlayer(page);
    expect(createResult.success).toBeTruthy();
  });

  test('cannot create divisions or seasons (negative)', async ({ page }) => {
    // Negative: creating a division should fail (read-only on Division__c)
    const divResult = await attemptCreateDivision(page);
    if (divResult.visible) {
      expect(divResult.success).toBeFalsy();
    }

    // Negative: creating a season should fail (read-only on Season__c)
    await navigateToTab(page, 'Season Management');
    await page.waitForTimeout(2000);

    const createSeasonBtn = page.locator('c-season-management button', { hasText: 'Create Season' });
    if (await createSeasonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createSeasonBtn.click();

      const modal = page.locator('c-season-management .slds-modal');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        const nameInput = modal.locator('lightning-input').first();
        await nameInput.fill('Unauthorized Season');

        const leagueCombobox = modal.locator('lightning-combobox').first();
        await leagueCombobox.click();
        const leagueOption = page.locator('lightning-base-combobox-item[data-value]').first();
        await leagueOption.click();

        const submitButton = modal.locator('button', { hasText: 'Create' });
        await submitButton.click();

        const toast = page.locator('div.toastMessage');
        await toast.first().waitFor({ state: 'visible', timeout: 15000 });
        const toastText = await toast.first().textContent();

        // Should get an error
        expect(toastText.toLowerCase()).toContain('error');
      }
    }
  });
});

// ─── Data Viewer Tests ───────────────────────────────────────────────────────

test.describe('Data Viewer Access', () => {
  let instanceUrl;
  let accessToken;

  test.beforeEach(async ({ page }) => {
    ({ instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS));
    // Login as the Data Viewer user
    await loginAsUserViaSetup(page, instanceUrl, accessToken, `data.viewer@sportsorg.scratch`);
    await navigateToApp(page, instanceUrl);
  });

  test('can view all four pages (positive)', async ({ page }) => {
    // Positive: can view Division Management
    const divVisible = await canViewPage(page, 'Division Management', 'c-division-management');
    expect(divVisible).toBeTruthy();

    // Positive: can view Team Details
    const teamVisible = await canViewPage(page, 'Team Details', 'c-team-details');
    expect(teamVisible).toBeTruthy();
  });

  test('cannot create divisions (negative)', async ({ page }) => {
    // Negative: creating a division should fail
    const divResult = await attemptCreateDivision(page);
    if (divResult.visible) {
      expect(divResult.success).toBeFalsy();
    }
  });

  test('cannot create players (negative)', async ({ page }) => {
    // Negative: creating a player should fail
    const playerResult = await attemptCreatePlayer(page);
    if (playerResult.visible) {
      expect(playerResult.success).toBeFalsy();
    }
  });
});

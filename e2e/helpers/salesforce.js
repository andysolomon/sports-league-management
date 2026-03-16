/**
 * Salesforce E2E Test Helpers
 *
 * Utility functions for authenticating and interacting with
 * Salesforce scratch orgs in Playwright tests.
 */

import { execSync } from 'child_process';

const APP_NAME = 'Sports_League_Management';

/**
 * Authenticate via sf CLI and return instanceUrl + accessToken.
 * @param {string} orgAlias - Scratch org alias
 * @returns {{ instanceUrl: string, accessToken: string }}
 */
export function authenticateViaSf(orgAlias = 'sports-scratch') {
  const result = execSync(
    `sf org display --target-org ${orgAlias} --json`,
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(result);
  const { instanceUrl, accessToken } = parsed.result;
  if (!instanceUrl || !accessToken) {
    throw new Error(`Could not get credentials for org "${orgAlias}"`);
  }
  return { instanceUrl, accessToken };
}

/**
 * Authenticate as a specific user by username.
 * Generates a password if needed, then returns login credentials.
 * @param {string} orgAlias - Scratch org alias
 * @param {string} username - The username to authenticate as
 * @returns {{ instanceUrl: string, username: string, password: string }}
 */
export function authenticateAsUser(orgAlias = 'sports-scratch', username) {
  // Get the instance URL from the org
  const orgResult = execSync(
    `sf org display --target-org ${orgAlias} --json`,
    { encoding: 'utf8' }
  );
  const { instanceUrl } = JSON.parse(orgResult).result;

  // Generate password for the user (idempotent — fails silently if already set)
  try {
    execSync(
      `sf org generate password --target-org ${orgAlias} --on-behalf-of ${username} --json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch {
    // Password may already exist — that's fine
  }

  // Retrieve the generated password
  const userResult = execSync(
    `sf org display user --target-org ${orgAlias} --json`,
    { encoding: 'utf8' }
  );
  const userData = JSON.parse(userResult).result;

  // Query for the user's password via the org display of that specific user
  const passwordResult = execSync(
    `sf org display --target-org ${username} --json 2>/dev/null || sf data query --query "SELECT Id FROM User WHERE Username='${username}'" --target-org ${orgAlias} --json`,
    { encoding: 'utf8' }
  );

  // For non-admin users, we'll use the Login As flow instead
  return { instanceUrl, username, password: userData.password || null };
}

/**
 * Log in to a Salesforce org via the frontdoor.jsp endpoint.
 * @param {import('@playwright/test').Page} page
 * @param {string} instanceUrl
 * @param {string} accessToken
 */
export async function loginViaFrontdoor(page, instanceUrl, accessToken) {
  const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${accessToken}`;
  await page.goto(frontdoorUrl, { waitUntil: 'domcontentloaded' });
  // Wait for Lightning Experience to finish loading
  await page.waitForURL('**/lightning/**', { timeout: 30000 });
}

/**
 * Log in as a different user using the admin "Login As" flow.
 * Requires the current session to be an admin.
 * @param {import('@playwright/test').Page} page
 * @param {string} instanceUrl
 * @param {string} username - Username to log in as
 */
export async function loginAsUser(page, instanceUrl, username) {
  // Navigate to the user's record via Setup
  await page.goto(
    `${instanceUrl}/lightning/setup/ManageUsers/home`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForLightningReady(page);

  // Use URL-based login-as approach
  // First query the user ID
  const userIdScript = `
    const result = await fetch('/services/data/v58.0/query/?q=' +
      encodeURIComponent("SELECT Id FROM User WHERE Username = '${username}' LIMIT 1"),
      { headers: { 'Authorization': 'Bearer ' + document.cookie.match(/sid=([^;]+)/)?.[1] }});
    const data = await result.json();
    return data.records?.[0]?.Id;
  `;

  // Navigate to login-as URL directly
  await page.goto(
    `${instanceUrl}/servlet/servlet.su?oid=${await getOrgId(page)}&suorgadminid=${await getUserId(page, username)}&targetURL=/lightning/page/home`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForLightningReady(page);
}

/**
 * Navigate to a specific tab in the Sports League Management app.
 * @param {import('@playwright/test').Page} page
 * @param {string} tabName - The tab label (e.g., 'Division Management', 'Season Management')
 */
export async function navigateToTab(page, tabName) {
  // Map friendly names to tab API names used in URLs
  const tabMap = {
    'Home': 'standard-Home',
    'Leagues': 'League__c',
    'Teams': 'Team__c',
    'Team Details': 'Team_Details',
    'Division Management': 'Division_Management',
    'Season Management': 'Season_Management',
    'Player Roster': 'Player_Roster'
  };

  const tabApiName = tabMap[tabName] || tabName;

  // Click the tab in the navigation bar
  const tabLocator = page.locator(`one-app-nav-bar-item-root a[title="${tabName}"]`);

  if (await tabLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tabLocator.click();
  } else {
    // Fallback: try the "More" dropdown for overflow tabs
    const moreButton = page.locator('one-app-nav-bar-item-root button.slds-button[title="More"]');
    if (await moreButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreButton.click();
      const menuItem = page.locator(`one-app-nav-bar-menu-item a[title="${tabName}"]`);
      await menuItem.click({ timeout: 5000 });
    } else {
      // Direct URL navigation as last resort
      const baseUrl = page.url().split('/lightning/')[0];
      await page.goto(`${baseUrl}/lightning/n/${tabApiName}`, {
        waitUntil: 'domcontentloaded'
      });
    }
  }

  await waitForLightningReady(page);
}

/**
 * Navigate to the Sports League Management app.
 * @param {import('@playwright/test').Page} page
 * @param {string} instanceUrl
 */
export async function navigateToApp(page, instanceUrl) {
  await page.goto(
    `${instanceUrl}/lightning/app/c__${APP_NAME}`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForLightningReady(page);
}

/**
 * Wait for Lightning Experience to be fully loaded.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForLightningReady(page) {
  // Wait for the main Lightning container
  await page.waitForSelector(
    'one-app-launcher-header, one-app-nav-bar, .slds-global-header',
    { timeout: 30000 }
  );
  // Wait for any spinners to disappear
  await page.waitForFunction(
    () => document.querySelectorAll('lightning-spinner').length === 0,
    { timeout: 15000 }
  ).catch(() => {
    // Spinners might not exist at all — that's OK
  });
  // Small settle time for dynamic content
  await page.waitForTimeout(1000);
}

/**
 * Wait for a Lightning toast message to appear and verify its text.
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedMessage - Substring to match in the toast
 * @param {'success'|'error'|'warning'|'info'} [variant] - Optional toast variant
 * @returns {Promise<string>} The full toast message text
 */
export async function waitForToast(page, expectedMessage, variant) {
  const toastSelector = 'div.toastMessage, lightning-primitive-icon + div, div.slds-notify__content';

  const toastContainer = page.locator('.slds-notify_container, force-record-layout-section');
  const toast = page.locator('div.toastMessage');

  // Wait for the toast to appear
  await toast.first().waitFor({ state: 'visible', timeout: 15000 });

  const toastText = await toast.first().textContent();

  if (expectedMessage && !toastText.includes(expectedMessage)) {
    throw new Error(
      `Toast message mismatch. Expected to contain: "${expectedMessage}", got: "${toastText}"`
    );
  }

  // Optionally verify variant
  if (variant) {
    const toastEl = page.locator(`div.slds-notify_toast.slds-theme_${variant}`);
    await toastEl.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // Variant class may differ across Salesforce versions
    });
  }

  // Close the toast
  const closeButton = page.locator('button.toastClose, button[title="Close"]').first();
  if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeButton.click();
  }

  return toastText;
}

/**
 * Get the Org ID from the current page session.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function getOrgId(page) {
  return page.evaluate(() => {
    // eslint-disable-next-line no-undef
    return window.$A?.get('$SfdcSite.organizationId') || '';
  });
}

/**
 * Get a User ID by username via SOQL query through the page context.
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @returns {Promise<string>}
 */
async function getUserId(page, username) {
  return page.evaluate(async (uname) => {
    const response = await fetch(
      `/services/data/v58.0/query/?q=${encodeURIComponent(`SELECT Id FROM User WHERE Username = '${uname}' LIMIT 1`)}`,
      {
        headers: {
          'Authorization': `Bearer ${document.cookie.match(/sid=([^;]+)/)?.[1] || ''}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const data = await response.json();
    return data.records?.[0]?.Id || '';
  }, username);
}

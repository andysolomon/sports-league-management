/**
 * Global Auth Setup for Playwright E2E Tests
 *
 * Authenticates against the scratch org using `sf org display`
 * and stores the browser state for reuse across tests.
 */

import { test as setup } from '@playwright/test';
import { authenticateViaSf, loginViaFrontdoor, navigateToApp } from '../helpers/salesforce.js';

const ORG_ALIAS = process.env.SF_ORG_ALIAS || 'sports-scratch';
const AUTH_FILE = '.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  const { instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS);

  // Store instanceUrl for other tests to use
  process.env.SF_INSTANCE_URL = instanceUrl;

  // Log in via frontdoor
  await loginViaFrontdoor(page, instanceUrl, accessToken);

  // Navigate to the app to ensure session is established
  await navigateToApp(page, instanceUrl);

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILE });
});

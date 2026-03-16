# E2E Testing Guide

End-to-end tests for the Sports League Management app use [Playwright](https://playwright.dev/) to test against real Salesforce scratch orgs.

## Prerequisites

- Node.js 16+
- Salesforce CLI (`sf`)
- An active scratch org with deployed metadata and seed data
- Playwright browsers: `npx playwright install chromium`

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Create and set up a scratch org (if needed)
node scripts/create-scratch-org.js sports-scratch

# 4. Load seed data (if not done by create-scratch-org)
node scripts/seed-data.js sports-scratch

# 5. Run E2E tests
npm run test:e2e
```

Or use the convenience script:

```bash
./scripts/run-e2e-tests.sh sports-scratch
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run test:e2e` | Run all E2E tests headlessly |
| `npm run test:e2e:headed` | Run tests with visible browser |
| `npm run test:e2e:report` | Run tests and open HTML report |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SF_ORG_ALIAS` | `sports-scratch` | Scratch org alias for authentication |
| `SF_INSTANCE_URL` | (auto-detected) | Salesforce instance URL |

### Playwright Config

Configuration is in `playwright.config.js`:
- **Browser**: Chromium only (Lightning requires Chromium)
- **Timeout**: 60s per test, 30s navigation
- **Workers**: 1 (serial execution — Salesforce doesn't handle parallel well)
- **Auth**: Global setup authenticates once, reuses session

## How Authentication Works

1. Global setup (`e2e/fixtures/auth.setup.js`) runs first
2. Calls `sf org display` to get `instanceUrl` and `accessToken`
3. Navigates to `{instanceUrl}/secur/frontdoor.jsp?sid={accessToken}`
4. Saves browser state to `.auth/admin.json`
5. All subsequent tests reuse the saved session

For multi-user tests (permission testing), the admin "Login As" flow is used.

## Test Structure

```
e2e/
├── fixtures/
│   └── auth.setup.js          # Global authentication setup
├── helpers/
│   ├── salesforce.js          # Salesforce interaction utilities
│   └── test-data.js           # Known seed data constants
└── tests/
    ├── smoke.spec.js              # Basic app load verification
    ├── division-management.spec.js # Division CRUD tests
    ├── season-management.spec.js   # Season CRUD tests
    ├── player-roster.spec.js       # Player CRUD tests
    ├── team-details.spec.js        # Team details display tests
    └── permission-access.spec.js   # Role-based access tests
```

## Writing New Tests

### Basic Test Template

```javascript
import { test, expect } from '@playwright/test';
import { authenticateViaSf, loginViaFrontdoor, navigateToApp, navigateToTab, waitForToast } from '../helpers/salesforce.js';

const ORG_ALIAS = process.env.SF_ORG_ALIAS || 'sports-scratch';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    const { instanceUrl, accessToken } = authenticateViaSf(ORG_ALIAS);
    await loginViaFrontdoor(page, instanceUrl, accessToken);
    await navigateToApp(page, instanceUrl);
    await navigateToTab(page, 'My Tab Name');
  });

  test('should do something', async ({ page }) => {
    // Interact with the page
    const button = page.locator('c-my-component button', { hasText: 'Click Me' });
    await button.click();

    // Verify toast message
    await waitForToast(page, 'Success message');
  });
});
```

### Key Patterns

**Shadow DOM**: Playwright pierces shadow DOM automatically. Use `c-component-name` to scope locators:
```javascript
page.locator('c-division-management .slds-card')
```

**Modals**: SLDS modals use `.slds-modal`:
```javascript
const modal = page.locator('c-division-management .slds-modal');
await expect(modal).toBeVisible();
```

**Comboboxes**: Lightning comboboxes need click + option selection:
```javascript
const combobox = modal.locator('lightning-combobox');
await combobox.click();
const option = page.locator('lightning-base-combobox-item', { hasText: 'Value' });
await option.first().click();
```

**Toast Messages**: Use the `waitForToast` helper:
```javascript
await waitForToast(page, 'Division created successfully');
```

## Troubleshooting

### "Scratch org not found"
- Verify org exists: `sf org list`
- Re-authenticate: `sf org login web --alias sports-scratch`

### Tests timeout on login
- Check if org is still active: `sf org display --target-org sports-scratch`
- Scratch orgs expire after their duration (default 30 days)
- Create a new org: `node scripts/create-scratch-org.js`

### "No seed data" errors
- Load data: `node scripts/seed-data.js sports-scratch`
- Verify: `sf data query --query "SELECT COUNT() FROM League__c" --target-org sports-scratch`

### Lightning components don't load
- Ensure metadata is deployed: `sf project deploy start --target-org sports-scratch`
- Clear browser cache or use incognito
- Check for deployment errors in Setup > Deployment Status

### Permission tests fail
- Ensure permission sets are deployed: `sf project deploy start --source-dir sportsmgmt/main/default/permissionsets`
- Run user setup: `node scripts/setup-users.js sports-scratch`
- Verify assignments: `sf data query --query "SELECT Assignee.Username, PermissionSet.Name FROM PermissionSetAssignment WHERE PermissionSet.Name LIKE '%League%' OR PermissionSet.Name LIKE '%Team%' OR PermissionSet.Name LIKE '%Data%'" --target-org sports-scratch`

### Flaky tests
- Increase timeouts in `playwright.config.js`
- Add `await page.waitForTimeout(2000)` for dynamic content
- Use `waitForLightningReady(page)` after navigation

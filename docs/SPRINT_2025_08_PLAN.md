# Sprint 2025.08 — E2E Testing & Permission-Set Access Control

## Sprint Details

- **Sprint Name:** 2025.08 - E2E Testing & Access Control
- **Team:** Sports League Development Team
- **Start Date:** 2026-03-30
- **End Date:** 2026-04-10
- **Total Story Points:** 29

## Epic

**E2E Testing & Permission-Set Access Control** — Establish Playwright E2E testing against scratch orgs and enforce role-based access through granular permission sets, replacing the current single app-visibility-only permission set.

## Stories

### W-000022: [Infrastructure] Set Up Playwright E2E Testing Framework (5 pts) — DONE

Set up Playwright with Chromium, frontdoor.jsp auth, and a smoke test.

**Implementation:**
- `playwright.config.js` — Chromium-only, 60s timeout, serial execution
- `e2e/helpers/salesforce.js` — `authenticateViaSf()`, `loginViaFrontdoor()`, `navigateToTab()`, `waitForLightningReady()`, `waitForToast()`, `authenticateAsUser()`
- `e2e/fixtures/auth.setup.js` — Global auth setup via `sf org display`
- `e2e/tests/smoke.spec.js` — App load and navigation verification
- `package.json` — Added `@playwright/test`, `test:e2e`, `test:e2e:headed` scripts
- `.gitignore` — Added `test-results/`, `playwright-report/`, `.auth/`

### W-000023: [Security] Create Role-Based Permission Sets (5 pts) — DONE

Three new permission sets with differentiated CRUD access.

**Implementation:**
- `League_Administrator.permissionset-meta.xml` — Full CRUD on all 5 objects
- `Team_Manager.permissionset-meta.xml` — CRUD on Team/Player, Read on League/Division/Season
- `Data_Viewer.permissionset-meta.xml` — Read-only on all 5 objects
- `Admin.profile-meta.xml` — Added Season_Management and Player_Roster tab visibility

### W-000024: [Infrastructure] Update User Setup Script (3 pts) — DONE

Updated `setup-users.js` to assign role-based permission sets.

**Implementation:**
- Each user now gets `Sports_League_Management_Access` + their role-specific permission set
- `ensurePermissionSets()` queries all needed permission sets in one SOQL call
- Assignment loop handles multiple permission sets per user

### W-000025: [E2E Testing] Functional E2E Tests for All LWC Pages (8 pts) — DONE

Full CRUD E2E tests for all four LWC pages.

**Implementation:**
- `division-management.spec.js` — Load, create, edit, delete, filter, assign team
- `season-management.spec.js` — Load, create with dates/status, edit, delete, filter
- `player-roster.spec.js` — Load, create with all fields, edit, delete, filter by team
- `team-details.spec.js` — Load, select team, verify detail fields
- `e2e/helpers/test-data.js` — Constants for all seed data values

### W-000026: [E2E Testing] Permission-Based Access Control E2E Tests (5 pts) — DONE

E2E tests verifying role-based access for all three user roles.

**Implementation:**
- `permission-access.spec.js` — 3 test groups (Admin, Team Manager, Data Viewer)
- Admin: Can CRUD on all pages (positive)
- Team Manager: Can CRUD players (positive), cannot create divisions/seasons (negative)
- Data Viewer: Can view all pages (positive), cannot create anything (negative)
- Uses admin Login-As flow for multi-user testing

### W-000027: [Infrastructure] CI Integration and Documentation (3 pts) — DONE

Documentation and convenience scripts for E2E testing.

**Implementation:**
- `docs/E2E_TESTING_GUIDE.md` — Prerequisites, running tests, writing new tests, troubleshooting
- `scripts/run-e2e-tests.sh` — Checks org, loads seed data, runs Playwright
- `package.json` — Added `test:e2e:report` script
- `CLAUDE.md` — Added E2E testing section
- `docs/SPRINT_2025_08_PLAN.md` — This file

## Permission Matrix

| Object | League_Administrator | Team_Manager | Data_Viewer |
|--------|---------------------|-------------|-------------|
| League__c | CRUD | R | R |
| Team__c | CRUD | CRUD | R |
| Division__c | CRUD | R | R |
| Season__c | CRUD | R | R |
| Player__c | CRUD | CRUD | R |

## File Changes Summary

**New Files (16):**
- `playwright.config.js`
- `e2e/fixtures/auth.setup.js`
- `e2e/helpers/salesforce.js`
- `e2e/helpers/test-data.js`
- `e2e/tests/smoke.spec.js`
- `e2e/tests/division-management.spec.js`
- `e2e/tests/season-management.spec.js`
- `e2e/tests/player-roster.spec.js`
- `e2e/tests/team-details.spec.js`
- `e2e/tests/permission-access.spec.js`
- `sportsmgmt/main/default/permissionsets/League_Administrator.permissionset-meta.xml`
- `sportsmgmt/main/default/permissionsets/Team_Manager.permissionset-meta.xml`
- `sportsmgmt/main/default/permissionsets/Data_Viewer.permissionset-meta.xml`
- `scripts/run-e2e-tests.sh`
- `docs/E2E_TESTING_GUIDE.md`
- `docs/SPRINT_2025_08_PLAN.md`

**Modified Files (4):**
- `package.json` — Added Playwright dependency and scripts
- `.gitignore` — Added Playwright artifacts
- `sportsmgmt/main/default/profiles/Admin.profile-meta.xml` — Added tab visibility
- `scripts/setup-users.js` — Multi-permission-set assignment

# Sprint 2025.10 — E2E Test Coverage Sprint

## Sprint Details

- **Sprint Name:** 2025.10 - Sports League Development Team
- **Team:** Sports League Development Team
- **Start Date:** 2026-04-27
- **End Date:** 2026-05-08
- **Total Story Points:** 32
- **Epic:** E2E Testing & Permission-Set Access Control

## Context

Sprint 2025.10 (Frontend Enhancement) delivered 7 stories transforming the frontend with shadcn/ui, but E2E tests weren't updated to cover the new features. This sprint closes those coverage gaps with comprehensive Playwright tests for every new UI capability.

## Stories

### W-000034: [E2E] DataTable Interactions — Search, Sort, Pagination (5 pts, P0)

As a QA engineer, I want E2E tests validating DataTable search, sort, and pagination so that interactive table features are regression-tested.

**Acceptance Criteria:**

#### Scenario: Search filters table rows
**Given** the Players page is loaded with 12+ players
**When** I type a player name in the search input
**Then** only matching rows are displayed
**And** the result count updates accordingly

#### Scenario: Search is case-insensitive
**Given** the Players page is loaded
**When** I type a name in mixed case
**Then** matching rows appear regardless of case

#### Scenario: Search with no results shows empty state
**Given** the Players page is loaded
**When** I type a non-existent name in search
**Then** the table shows an empty state message
**And** no data rows are visible

#### Scenario: Column sorting toggles ascending/descending
**Given** a DataTable page (Players, Seasons, or Divisions) is loaded
**When** I click a sortable column header
**Then** the rows reorder in ascending order
**And** a sort indicator icon appears
**When** I click the same column header again
**Then** the rows reorder in descending order

#### Scenario: Pagination controls appear for large datasets
**Given** a table has more than 10 rows
**When** the page loads
**Then** Previous/Next pagination buttons are visible
**And** a page indicator shows "Page 1 of N"
**And** a row count shows "Showing 1-10 of X"

#### Scenario: Pagination navigation works
**Given** a table with pagination showing page 1
**When** I click the Next button
**Then** page 2 rows are displayed
**And** the page indicator updates
**When** I click the Previous button
**Then** page 1 rows are displayed again

**Context:** DataTable component at `apps/web/src/components/data-table.tsx`. Used on Players, Seasons, Divisions, and Team Detail roster.

**Implementation Plan:** File: `apps/web/e2e/tests/data-table.spec.ts`. Test on Players page (12 rows, pageSize 10). Search for "Prescott" → 1 row. Search "PRESCOTT" (case-insensitive). Search "ZZZZNONEXISTENT" → empty state. Click Name sort button twice, verify order changes. Assert pagination text "Showing 1–10 of 12" and "Page 1 of 2". Click Next/Previous, verify page updates.

---

### W-000035: [E2E] Mobile Responsive Navigation — Hamburger Menu and Sheet Overlay (5 pts, P0)

As a QA engineer, I want E2E tests for mobile responsive navigation so that hamburger menu, Sheet overlay, and responsive layout behavior are regression-tested.

**Acceptance Criteria:**

#### Scenario: Hamburger button visible on mobile viewport
**Given** the browser viewport is set to mobile width (375px)
**When** the dashboard page loads
**Then** a hamburger menu button is visible in the header
**And** the desktop sidebar is hidden

#### Scenario: Hamburger opens Sheet overlay with navigation
**Given** the browser is at mobile width
**When** I click the hamburger menu button
**Then** a Sheet overlay slides in from the left
**And** all navigation links are visible (Overview, Teams, Players, Seasons, Divisions, Leagues)

#### Scenario: Sheet closes on navigation
**Given** the Sheet overlay is open on mobile
**When** I click a navigation link (e.g., Players)
**Then** the Sheet closes
**And** I am navigated to the Players page

#### Scenario: Desktop sidebar visible on large viewport
**Given** the browser viewport is set to desktop width (1280px)
**When** the dashboard page loads
**Then** the sidebar is visible with icon+label navigation
**And** the hamburger button is not visible

#### Scenario: Navigation icons render on desktop sidebar
**Given** the browser is at desktop width
**When** the dashboard page loads
**Then** each nav item displays a Lucide icon next to the label

**Context:** Mobile header at `apps/web/src/app/dashboard/_components/mobile-header.tsx`, Sidebar at `apps/web/src/app/dashboard/_components/sidebar.tsx`.

**Implementation Plan:** File: `apps/web/e2e/tests/mobile-navigation.spec.ts`. Set viewport 375×812, assert hamburger visible and aside hidden. Click hamburger, verify all 6 nav links in Sheet. Click Players link, verify URL and Sheet closes. Set viewport 1280×800, assert aside visible and hamburger hidden. Assert each nav link contains an SVG icon.

---

### W-000036: [E2E] Leagues Hierarchy Page — Cards, Divisions, Team Links (5 pts, P0)

As a QA engineer, I want E2E tests for the Leagues hierarchy page so that league cards, division groupings, team links, and empty states are regression-tested.

**Acceptance Criteria:**

#### Scenario: Leagues page loads with hierarchy
**Given** I navigate to /dashboard/leagues
**When** the page loads
**Then** a "Leagues" heading is visible
**And** at least one league card is displayed

#### Scenario: League card shows division count badge
**Given** the Leagues page is loaded
**When** I view a league card
**Then** the card displays the league name
**And** a badge shows the number of divisions

#### Scenario: Divisions listed under league with team counts
**Given** the Leagues page is loaded
**When** I view a league card with divisions
**Then** each division name is displayed
**And** each division shows a badge with team count

#### Scenario: Team links navigate to team detail
**Given** the Leagues page is loaded with teams under a division
**When** I click a team name link
**Then** I am navigated to /dashboard/teams/{teamId}
**And** the team detail page loads

#### Scenario: Empty state for league with no divisions
**Given** a league exists with no divisions
**When** the Leagues page is loaded
**Then** that league card shows an empty state message

**Context:** Leagues page at `apps/web/src/app/dashboard/leagues/page.tsx`.

**Implementation Plan:** File: `apps/web/e2e/tests/leagues.spec.ts`. Navigate to /dashboard/leagues, assert heading and cards. Find NFL card, verify division count badge. Check divisions have team count badges. Click team link (Dallas Cowboys), verify navigation to team detail. Check leagues with divisions don't show empty state text.

---

### W-000037: [E2E] Player CRUD — Dialog Modals and Toast Notifications (8 pts, P0)

As a QA engineer, I want E2E tests for player create, edit, and delete flows so that Dialog modals, form validation, toast notifications, and data mutations are regression-tested.

**Acceptance Criteria:**

#### Scenario: Add Player button opens Dialog modal
**Given** I am on a team detail page with manager permissions
**When** I click the "Add Player" button
**Then** a Dialog modal opens with a player creation form
**And** the form has fields for Name, Position, Jersey Number, and Status

#### Scenario: Create player with valid data
**Given** the Add Player dialog is open
**When** I fill in Name, Position, Jersey Number, and Status
**And** I click Submit
**Then** a success toast notification appears
**And** the dialog closes
**And** the new player appears in the roster table

#### Scenario: Create player form validation
**Given** the Add Player dialog is open
**When** I submit the form without required fields
**Then** validation error messages are displayed
**And** the form remains open

#### Scenario: Edit Player opens pre-populated Dialog
**Given** I am on a team detail page with a player roster
**When** I click the Edit button for a player
**Then** a Dialog modal opens with the player's current data pre-filled

#### Scenario: Edit player saves changes
**Given** the Edit Player dialog is open with pre-filled data
**When** I change the player's position
**And** I click Submit
**Then** a success toast notification appears
**And** the dialog closes
**And** the updated data is visible in the roster

#### Scenario: Delete player with AlertDialog confirmation
**Given** I am on a team detail page with a player roster
**When** I click the Delete button for a player
**Then** an AlertDialog confirmation appears
**When** I click Confirm
**Then** a success toast notification appears
**And** the player is removed from the roster

#### Scenario: Delete player cancel
**Given** the delete AlertDialog is open
**When** I click Cancel
**Then** the dialog closes
**And** the player remains in the roster

#### Scenario: Error toast on failed mutation
**Given** a player mutation fails (network or server error)
**When** the API returns an error
**Then** an error toast notification appears
**And** the dialog remains open

**Context:** Player form at `apps/web/src/app/dashboard/_components/player-form.tsx`, Delete confirm at `apps/web/src/app/dashboard/_components/delete-confirm.tsx`.

**Implementation Plan:** File: `apps/web/e2e/tests/player-crud.spec.ts`. Uses `test.describe.serial`. Navigate to Cowboys team detail. Open Add Player dialog, verify form fields. Create "E2E Test Player" (TE, #99, Active), verify toast and roster. Test validation with empty name. Edit test player, verify pre-populated fields. Change position to WR, verify update. Delete test player with confirmation. Test cancel on delete for Prescott. Intercept POST /api/players with 500 for error toast.

---

### W-000038: [E2E] Team Edit — Dialog Modal and Toast Notification (3 pts, P1)

As a QA engineer, I want E2E tests for the team edit flow so that the edit Dialog modal, form submission, and toast notifications are regression-tested.

**Acceptance Criteria:**

#### Scenario: Edit Team button visible for managers
**Given** I am on a team detail page with manager permissions
**When** the page loads
**Then** an "Edit Team" button is visible in the team info card

#### Scenario: Edit Team opens Dialog with pre-populated data
**Given** I am on a team detail page
**When** I click the "Edit Team" button
**Then** a Dialog modal opens
**And** the form is pre-filled with current team name, city, stadium, and founded year

#### Scenario: Edit team saves changes successfully
**Given** the Edit Team dialog is open
**When** I change the team city
**And** I click Submit
**Then** a success toast notification appears
**And** the dialog closes
**And** the updated city is displayed on the team detail page

#### Scenario: Edit team form validation
**Given** the Edit Team dialog is open
**When** I clear the required team name field
**And** I click Submit
**Then** a validation error is displayed
**And** the form remains open

#### Scenario: Edit team error handling
**Given** the Edit Team dialog is open
**When** the update API call fails
**Then** an error toast notification appears
**And** the dialog remains open for retry

**Context:** Team edit form at `apps/web/src/app/dashboard/_components/team-edit-form.tsx`.

**Implementation Plan:** File: `apps/web/e2e/tests/team-edit.spec.ts`. Uses `test.describe.serial`. Navigate to Cowboys team detail. Verify Edit Team button visible. Click Edit Team, verify pre-populated fields (name, city). Change city to "Dallas-FW", verify toast and page update, then restore to "Dallas". Test validation with empty name. Intercept PUT/PATCH /api/teams/* with 500 for error toast.

---

### W-000039: [E2E] Updated Navigation and Overview Tests (3 pts, P1)

As a QA engineer, I want to update existing navigation and overview E2E tests to reflect the new shadcn/ui components and Leagues nav item so that existing tests stay aligned with the current UI.

**Acceptance Criteria:**

#### Scenario: Sidebar includes Leagues navigation item
**Given** I am on any dashboard page at desktop width
**When** the sidebar renders
**Then** a "Leagues" navigation link is visible
**And** it links to /dashboard/leagues

#### Scenario: Overview stat cards include Leagues count
**Given** I navigate to the dashboard overview
**When** the page loads
**Then** stat cards display for Teams, Players, Seasons, Divisions, and Leagues
**And** each card shows a count greater than zero

#### Scenario: Stat card navigation includes Leagues
**Given** the dashboard overview is loaded
**When** I click the Leagues stat card
**Then** I am navigated to /dashboard/leagues

#### Scenario: Overview cards use shadcn Card component styling
**Given** the dashboard overview is loaded
**When** I inspect the stat cards
**Then** each card has an icon with colored background
**And** cards display hover shadow effects

#### Scenario: Active navigation highlighting
**Given** I navigate to the Leagues page
**When** the page loads
**Then** the Leagues nav link is styled as active
**And** other nav links are not styled as active

#### Scenario: Navigation accessibility
**Given** the dashboard page is loaded
**When** I inspect the sidebar
**Then** the nav element has `role="navigation"`
**And** a skip-to-content link is present in the DOM

**Context:** Updates to existing tests `navigation.spec.ts` and `dashboard-overview.spec.ts`. Sidebar at `apps/web/src/app/dashboard/_components/sidebar.tsx`.

**Implementation Plan:** Modify `navigation.spec.ts`: add Leagues to NAV_ITEMS, add Leagues active highlighting test, add nav accessibility role test. Modify `dashboard-overview.spec.ts`: update labels to include Leagues (5 cards), update card count to 5, fix count selector from text-3xl to text-2xl, add Leagues card navigation test, add icon background and hover shadow tests.

---

### W-000040: [E2E] Status Badges and Date Formatting (3 pts, P1)

As a QA engineer, I want E2E tests for StatusBadge color variants and formatted dates so that visual data presentation is regression-tested.

**Acceptance Criteria:**

#### Scenario: Active status renders green badge
**Given** the Players page is loaded
**When** I view a player with Active status
**Then** the status column shows a green-styled badge with text "Active"

#### Scenario: Injured status renders yellow badge
**Given** the Players page is loaded
**When** I view a player with Injured status
**Then** the status column shows a yellow-styled badge with text "Injured"

#### Scenario: Inactive status renders gray badge
**Given** the Players page is loaded
**When** I view a player with Inactive status
**Then** the status column shows a gray-styled badge with text "Inactive"

#### Scenario: Season status badges render correctly
**Given** the Seasons page is loaded
**When** I view the status column
**Then** Active seasons show a green badge
**And** Completed seasons show a gray badge
**And** Upcoming/Planned seasons show an appropriate color badge

#### Scenario: Dates display in formatted style
**Given** the Seasons page is loaded
**When** I view the Start Date and End Date columns
**Then** dates are formatted as human-readable strings (e.g., "Jan 01, 2025")
**And** raw ISO date strings are not shown

#### Scenario: Null dates show dash
**Given** a record has a null date field
**When** it is displayed in the table
**Then** the cell shows a dash character instead of empty or "null"

#### Scenario: Team detail founded year displays
**Given** I navigate to a team detail page
**When** the page loads
**Then** the Founded field shows a four-digit year

**Context:** StatusBadge at `apps/web/src/components/status-badge.tsx`, Format utilities at `apps/web/src/lib/format.ts`.

**Implementation Plan:** File: `apps/web/e2e/tests/status-badges.spec.ts`. On Players page: Prescott (Active) → bg-green-100, Parsons (Injured) → bg-yellow-100, Barmore (Inactive, search to find on page 2) → bg-gray-100. On Seasons page: NFL 2025 (Active) → bg-green-100, NFL 2024 (Completed) → bg-green-100. Verify dates match "Mon D, YYYY" format, no ISO strings. Check em-dash for null dates. Navigate to Cowboys detail, verify founded year "1960".

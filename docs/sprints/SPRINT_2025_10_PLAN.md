# Sprint 2025.10 — Frontend Enhancement Sprint

## Sprint Details

- **Sprint Name:** 2025.10 - Sports League Development Team
- **Team:** Sports League Development Team
- **Start Date:** 2026-05-04
- **End Date:** 2026-05-15
- **Total Story Points:** 30

## Epic

**Frontend Enhancement Sprint** — Transform the MVP Next.js frontend into a polished, production-ready application by establishing a design system foundation (shadcn/ui), delivering responsive navigation, reusable data tables with search/sort/pagination, toast notifications, skeleton loading states, status badges, a new League management page, and accessibility foundations.

## Stories

### W-000034: [Design System] Integrate shadcn/ui Component Library (5 pts)

Install and configure shadcn/ui as the foundational component library, providing accessible, Tailwind-native primitives that all subsequent stories depend on.

**Acceptance Criteria:**
- `cn()` utility in `src/lib/utils.ts` using `clsx` + `tailwind-merge`
- shadcn/ui components created in `src/components/ui/`: Button, Badge, Card, Input, Label, Dialog, AlertDialog, Select, Separator, Sheet, Skeleton, Table, DropdownMenu
- All components use CVA for variant management and Radix primitives for accessibility
- `globals.css` extended with animation keyframes for shadcn transitions
- `pnpm turbo build` passes with no type errors

**Implementation Plan:**
1. Install dependencies: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `@radix-ui/react-alert-dialog`
2. Create `src/lib/utils.ts` with `cn()` helper
3. Create 13 shadcn/ui component files in `src/components/ui/`
4. Extend `globals.css` with `animate-in`/`animate-out` keyframes
5. Verify build passes with `pnpm turbo build`

### W-000035: [Navigation] Responsive Mobile-First Navigation (5 pts)

Replace the static desktop-only sidebar with a responsive layout: collapsible sidebar on desktop, hamburger menu with Sheet overlay on mobile/tablet.

**Acceptance Criteria:**
- Desktop (lg+): fixed sidebar with icon+label navigation, Leagues nav item added
- Mobile/Tablet (<lg): hamburger menu in header, Sheet slide-out with full navigation
- NavLink updated with Lucide icons and `cn()` for conditional classes
- Sheet auto-closes on navigation
- Dashboard header adapts between mobile (hamburger + title + UserButton) and desktop (title + UserButton)

**Implementation Plan:**
1. Create `src/app/dashboard/_components/sidebar.tsx` with icon-based navigation including Leagues
2. Create `src/app/dashboard/_components/mobile-header.tsx` with Sheet-based hamburger menu
3. Update `nav-link.tsx` to accept optional `icon` prop and `onClick` handler
4. Rewrite `dashboard/layout.tsx` to show desktop sidebar (hidden on mobile) and mobile header (hidden on desktop)
5. Add responsive padding to main content area (`p-4 sm:p-6 lg:p-8`)

### W-000036: [Data Tables] Reusable DataTable with Search, Sort, Pagination (8 pts)

Build a generic `DataTable<T>` component that replaces all plain HTML tables with search, column sorting, and client-side pagination.

**Acceptance Criteria:**
- `DataTable<T>` component with configurable columns, search, sort, and pagination
- Column definition supports `sortable`, custom `render`, and `accessor` functions
- Search filters across configurable keys with debounced input
- Pagination with configurable page size and prev/next controls
- Migrated pages: Players, Seasons, Divisions, Team Detail roster
- Empty state component used when no data exists

**Implementation Plan:**
1. Create `src/components/data-table.tsx` with generic `DataTable<T>` accepting `Column<T>[]`
2. Create `src/components/empty-state.tsx` for empty table states
3. Create client-side table wrapper components: `players-table.tsx`, `seasons-table.tsx`, `divisions-table.tsx`
4. Update server page components to pass data to client table wrappers
5. Update `team-management.tsx` to use `DataTable` with action buttons for edit/delete

### W-000037: [Feedback] Toast Notifications and Skeleton Loading States (3 pts)

Add Sonner toast notifications for all mutations and `loading.tsx` skeleton screens for every dashboard page.

**Acceptance Criteria:**
- `Toaster` added to root layout with `position="bottom-right"` and `richColors`
- Toast fired on: create player (success), edit player (success), delete player (success), edit team (success), all mutation errors
- `loading.tsx` with appropriate skeletons for: dashboard overview, players, seasons, divisions, teams, leagues
- Skeleton components: `TableSkeleton`, `CardSkeleton`

**Implementation Plan:**
1. Install `sonner` and add `<Toaster />` to `src/app/layout.tsx`
2. Create `src/components/skeletons/table-skeleton.tsx` and `card-skeleton.tsx`
3. Create `loading.tsx` files for each dashboard route
4. Add `toast.success()` / `toast.error()` calls to `player-form.tsx`, `team-edit-form.tsx`, and `team-management.tsx` delete handler

### W-000038: [Polish] Status Badges, Date Formatting, and Visual Polish (3 pts)

Add semantic status badges, formatted dates, and visual consistency across all pages.

**Acceptance Criteria:**
- `StatusBadge` component maps statuses to colored Badge variants (Active=green, Injured=yellow, Inactive=gray, etc.)
- `formatDate()` and `calculateAge()` utilities in `src/lib/format.ts`
- Season dates displayed as formatted dates instead of raw strings
- Dashboard overview cards use icons with colored icon backgrounds
- Card component used for team detail info section

**Implementation Plan:**
1. Create `src/components/status-badge.tsx` with status-to-variant mapping
2. Create `src/lib/format.ts` with `formatDate()` and `calculateAge()` helpers
3. Update `seasons-table.tsx` to use `formatDate()` for date columns
4. Update `dashboard/page.tsx` overview cards to use `Card` component with Lucide icons
5. Update `team-management.tsx` to use `Card` component for team info

### W-000039: [Feature] League Management Page with Hierarchy View (3 pts)

Create a new Leagues page that displays the league > division > team hierarchy, providing a top-down view of the organizational structure.

**Acceptance Criteria:**
- New `/dashboard/leagues` route accessible from sidebar navigation
- Fetches leagues, divisions, and teams in parallel
- Displays each league as a Card with divisions nested inside
- Each division shows its teams as clickable links to team detail pages
- Badge counts for divisions per league and teams per division
- Empty states for leagues with no divisions or divisions with no teams

**Implementation Plan:**
1. Add Leagues nav item to sidebar (between Overview and Teams)
2. Create `src/app/dashboard/leagues/page.tsx` as server component
3. Build hierarchy data structure: leagues > divisions (by leagueId) > teams (by divisionId)
4. Render Card per league, nested divisions with team links
5. Add `loading.tsx` and `error.tsx` for the leagues route

### W-000040: [Accessibility] Accessibility Foundations (3 pts)

Add core accessibility features: skip-to-content link, ARIA landmarks, focus management, form labels, and error boundaries for graceful degradation.

**Acceptance Criteria:**
- Skip-to-content link in dashboard layout that focuses main content area
- Main content area has `id="main-content"` landmark
- Sidebar navigation has `role="navigation"` and `aria-label`
- All form inputs have associated `<Label>` with `htmlFor` attribute
- Error boundaries (`error.tsx`) for every dashboard route with "Try again" button
- Alert dialogs use proper ARIA roles via Radix AlertDialog primitive

**Implementation Plan:**
1. Add skip-to-content link and CSS in `globals.css` and `dashboard/layout.tsx`
2. Add `id="main-content"` to main element and `role="navigation"` to sidebar nav
3. Update `player-form.tsx` and `team-edit-form.tsx` to use `Label` with `htmlFor`
4. Create `error.tsx` files for: dashboard, players, seasons, divisions, teams, leagues
5. Migrate `delete-confirm.tsx` to Radix `AlertDialog` for proper focus trapping

## Phasing / Dependency Order

```
Day 1-2:  W-000034 (Design System) ─── foundational
Day 3-4:  W-000035 (Nav) + W-000037 (Toasts/Loading) ─── parallel
Day 5-8:  W-000036 (Data Tables) ─── largest story
Day 8-9:  W-000038 (Badges/Polish) + W-000039 (Leagues) ─── parallel
Day 9-10: W-000040 (A11y & Errors)
```

## Deferred to Sprint 2025.11

Dark mode, charts/analytics dashboard, data export (CSV/PDF), bulk actions, breadcrumbs, full accessibility audit, role-based dashboards, team communication/messaging.

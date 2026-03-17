# External Frontend Current State

## Purpose

This document inventories the current repository shape, application boundaries, and security assumptions so external frontend work can start from repository evidence instead of guesses.

## Executive Summary

The current product is a Salesforce-native application. Salesforce is both:

- the UI host via Lightning App and LWC
- the business logic runtime via Apex
- the system of record for core sports-management objects
- the identity and permission boundary for all current users

There is no external-facing API layer, external identity configuration, or non-Salesforce frontend checked into this repository today.

## Repository Shape

### Active package layout

- `sportsmgmt/` is the main Salesforce DX package and contains the implemented app.
- `sportsmgmt-football/` is declared as a dependent package in `sfdx-project.json`, but it is still mostly skeletal.
- Root-level Node tooling supports Salesforce development, testing, and automation rather than a general-purpose app monorepo.

### Evidence

- `sfdx-project.json`
- `package.json`
- `README.md`

## Current UI Boundary

### UI runtime

The current user experience runs inside Salesforce Lightning:

- `sportsmgmt/main/default/applications/Sports_League_Management.app-meta.xml`
- `sportsmgmt/main/default/lwc/`
- `sportsmgmt/main/default/tabs/`

The app metadata describes the product as a Lightning workspace for league administrators and exposes Lightning tabs such as `League__c`, `Team__c`, `Team_Details`, `Season_Management`, and `Player_Roster`.

### Frontend implementation style

The UI is built with LWC components that call Apex controllers directly. Representative examples:

- `sportsmgmt/main/default/lwc/divisionManagement/divisionManagement.js`
- `sportsmgmt/main/default/lwc/teamDetails/`
- `sportsmgmt/main/default/lwc/playerRoster/`
- `sportsmgmt/main/default/lwc/seasonManagement/`

These components are tightly coupled to `@AuraEnabled` Apex methods and Salesforce session context.

## Current Backend Boundary

### Controller layer

The current application boundary is a set of Lightning-specific Apex controllers:

- `sportsmgmt/main/default/classes/lightning/DivisionManagementController.cls`
- `sportsmgmt/main/default/classes/lightning/SeasonManagementController.cls`
- `sportsmgmt/main/default/classes/lightning/PlayerRosterController.cls`
- `sportsmgmt/main/default/classes/lightning/TeamDetailsController.cls`

These classes expose `@AuraEnabled` methods for reads and mutations. That makes them suitable for LWC use inside Salesforce, but they are not a stable public contract for an external web app.

### Service and repository layer

Business logic is more reusable below the controller layer:

- `sportsmgmt/main/default/classes/service/DivisionService.cls`
- `sportsmgmt/main/default/classes/service/SeasonService.cls`
- `sportsmgmt/main/default/classes/service/PlayerService.cls`
- `sportsmgmt/main/default/classes/service/TeamService.cls`
- `sportsmgmt/main/default/classes/service/*Repository.cls`

This is the most promising reuse point if the project later adds:

- Apex REST endpoints
- a middleware/BFF integration layer
- a separate operator API contract

### Reuse assessment

Likely reusable:

- domain services
- repository queries and mutations
- wrapper/interface model

Not reusable as-is for public app traffic:

- `@AuraEnabled` controller contracts
- Lightning-specific error handling
- browser-session assumptions

## Current Data Boundary

### Core records live in Salesforce

Current evidence indicates the following primary records are Salesforce-owned:

- `League__c`
- `Team__c`
- `Division__c`
- `Season__c`
- `Player__c`

The current app, permission sets, and E2E tests all assume these records are created, read, updated, and deleted in Salesforce.

### External data ownership status

No external application database, sync pipeline, or event-driven integration boundary exists in the repository today.

## Current Identity And Access Model

### Current users are Salesforce users

The repo currently provisions and configures Salesforce users for the app:

- `scripts/setup-users.js`

That script assigns:

- `Sports_League_Management_Access`
- `League_Administrator`
- `Team_Manager`
- `Data_Viewer`

It also assumes trusted scratch-org users and operator personas, not consumer or customer identities.

### Permission model characteristics

The permission sets under `sportsmgmt/main/default/permissionsets/` show a staff-style access model:

- app access is granted separately from object permissions
- object CRUD is role-based
- many objects use `viewAllRecords=true`
- tab visibility is optimized for operator workflows

This is suitable for internal staff but not for end-user tenancy or per-customer isolation.

### Security hardening gaps for external use

No explicit evidence was found for:

- `WITH SECURITY_ENFORCED`
- `stripInaccessible`
- explicit CRUD/FLS guard checks in Apex
- external REST resources

That does not mean the app is insecure for current use, but it does mean the repo does not yet contain an API-hardening layer appropriate for a public external frontend.

## Current Authentication And Testing Assumptions

### Authentication

Current E2E auth flows assume direct Salesforce access:

- `e2e/fixtures/auth.setup.js`
- `e2e/helpers/salesforce.js`

The tests authenticate through:

- `sf org display`
- `frontdoor.jsp`
- admin `Login As`
- direct Lightning app navigation

### Implication

There is no existing support in source control for:

- Google sign-in
- external OIDC auth
- an Experience Cloud site
- a Connected App
- an external BFF session model

## External Frontend Implications

If an external React app is added, the repo will need a new boundary for all of the following:

- user authentication
- app session management
- authorization by league/team/account scope
- API contracts separate from `@AuraEnabled`
- integration identity for Salesforce access
- sync or source-of-truth rules for core records

## Candidate Capability Map

The current app appears to group naturally into these capability areas:

- league and team reference data
- division management
- season management
- player roster management
- team detail lookup and presentation

Near-term candidates for external consumption:

- read-only roster/team/season browsing
- authenticated team-manager mutations through a backend
- operator-side administration remaining in Lightning

## Recommended Next Questions

Before implementation, decide:

1. Is Salesforce staying the source of truth for the five custom objects?
2. Will the external app have its own database?
3. Will external users ever need a Salesforce representation?
4. Should the first external surface be read-only, team-manager CRUD, or a broader customer workflow?

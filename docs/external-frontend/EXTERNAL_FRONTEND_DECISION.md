# External Frontend Decision

## Decision

Adopt a staged version of Option A:

- keep Salesforce as the near-term system of record for the current sports-management objects
- keep Salesforce for league operators only
- build the external product as a separate web app with Google sign-in
- put a backend/BFF between the web app and Salesforce
- use a dedicated, least-privilege Salesforce integration identity for backend access

## Why This Is The Right Near-Term Choice

This repository is already organized around Salesforce-native capabilities:

- Lightning app navigation
- LWC UI components
- Apex controllers and services
- operator-centric permission sets
- scratch-org and Playwright flows that assume direct Salesforce sessions

Moving immediately to an app-owned data platform would add more moving parts before the project has defined:

- external user roles
- tenancy boundaries
- API contracts
- sync rules
- app-specific domain ownership

Option A introduces the minimum new architecture needed to support an external product without forcing every end user into Salesforce.

## What This Means

### Internal users

League operators continue to work inside Salesforce using the existing app and permission sets.

### External users

External users sign into the new web app with Google or another OIDC provider. They do not need Salesforce user accounts.

### Integration boundary

The external app must not call current `@AuraEnabled` Apex methods directly. Instead, add a new application boundary:

- backend-owned domain API
- or Salesforce API access through middleware
- or purpose-built Apex REST endpoints if Salesforce remains the dominant backend

## Integration Identity Recommendation

Create a dedicated Salesforce integration identity with a separate permission model.

### Principles

- do not reuse `League_Administrator`, `Team_Manager`, or `Data_Viewer`
- do not grant `viewAllRecords` unless absolutely necessary
- scope access to only the objects, fields, and operations required by the external app
- separate operator permissions from machine permissions

### Suggested shape

- one integration user
- one integration profile or minimal base profile
- one or more app-specific permission sets
- a clearly documented API access matrix by use case

## Security Requirements Before External Launch

Before any public app traffic is routed through Salesforce-backed workflows, add:

- explicit authorization rules in the backend/BFF
- CRUD/FLS review for any data returned from Salesforce
- request-level audit logging for external mutations
- rate limiting and abuse controls in the web/backend layer
- contract tests for all public API operations

## Data Ownership Recommendation

Near-term ownership:

- keep `League__c`, `Team__c`, `Division__c`, `Season__c`, and `Player__c` owned in Salesforce

Re-evaluate later if the external app starts owning workflows such as:

- self-service registration
- payments
- scheduling interactions
- realtime messaging
- fan/community activity
- complex end-user personalization

Those use cases would make an app-owned operational database more attractive.

## Technology Direction

### Frontend

- React is a strong fit
- Next.js is the simplest mainstream choice if you want a web app plus server-side routes

### Backend

- a BFF or API server is required
- choose between Next.js server routes, a separate Node service, or Convex based on how much app-owned logic you want

### Convex guidance

Convex is a good fit if:

- the external app will quickly grow beyond simple Salesforce-backed CRUD
- you want realtime features
- you are comfortable making the external app a true product platform

Convex is a weaker fit if:

- the first release is mostly a secure facade over Salesforce-managed records
- you want to minimize operational surface area initially

## Phased Roadmap

### Phase 1: Boundary definition

- identify the first external user journeys
- define user-to-league or user-to-team authorization rules
- specify the API contract for those journeys
- design the integration-user permission model

### Phase 2: External app skeleton

- bootstrap the web app
- add Google sign-in
- implement backend/BFF session handling
- add a minimal API layer for read-only use cases first

### Phase 3: Salesforce integration hardening

- implement purpose-built backend-to-Salesforce operations
- add least-privilege access in Salesforce
- add monitoring, auditability, and contract tests

### Phase 4: Expanded product scope

- add mutation flows for team managers or equivalent external roles
- evaluate whether some runtime data should move out of Salesforce
- revisit whether Convex or another app database is justified

## Deferred Decisions

These should stay open until the first external user journeys are selected:

- whether to use Convex immediately
- whether the app should own any domain records from day one
- whether the repo should become a monorepo immediately or one phase later

## Final Recommendation

Build the external app, but treat it as a new bounded product surface rather than an alternate UI for current Lightning controllers. Keep Salesforce focused on operator workflows, add Google sign-in in the external app, and introduce a backend/BFF with a dedicated integration identity as the first architectural expansion.

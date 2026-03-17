---
name: external-frontend-architecture
description: Evaluates how to introduce an external frontend alongside this Salesforce app, including Google sign-in, operator-only Salesforce access, data ownership, integration-user boundaries, and monorepo timing. Use when planning external app architecture, auth strategy, backend/BFF design, or Turborepo adoption for this repo.
---

# External Frontend Architecture

## Use This Skill When

- the user asks about Google login or external users
- the user wants Salesforce limited to league operators
- the user is considering React, Next.js, Convex, or a backend/BFF
- the user asks whether to use a monorepo or Turborepo
- architecture docs in `docs/external-frontend/` need to be created or updated

## Current Repo Assumption

Start from the current baseline:

- Salesforce is the current UI host and backend runtime
- LWC components call `@AuraEnabled` Apex controllers
- permission sets are operator-centric
- no external auth, Connected App, or external API layer is checked into source

## Default Recommendation Pattern

Unless repo evidence or the user's requirements point elsewhere:

1. Keep Salesforce for league operators only.
2. Put external users in a separate web app with Google or OIDC sign-in.
3. Use a backend/BFF between the web app and Salesforce.
4. Create a dedicated least-privilege integration identity for Salesforce access.
5. Treat direct reuse of current `@AuraEnabled` controllers as a risk, not the default.

## Exploration Workflow

1. Read the current architecture and docs under:
   - `README.md`
   - `package.json`
   - `docs/external-frontend/`
   - relevant controllers, services, permission sets, and setup scripts
2. Identify:
   - which capabilities are Lightning-only
   - which business logic is reusable below the controller layer
   - what the current permission model assumes about Salesforce users
3. Compare target options:
   - Salesforce as system of record behind a BFF
   - external app owns runtime data, Salesforce as back office
   - Experience Cloud or Salesforce-hosted external access
4. Document:
   - auth and identity model
   - data ownership recommendation
   - integration-user requirements
   - monorepo timing and folder shape

## Deliverables

When the task is documentation-focused, prefer updating or creating:

- `docs/external-frontend/EXTERNAL_FRONTEND_CURRENT_STATE.md`
- `docs/external-frontend/EXTERNAL_FRONTEND_ARCHITECTURE_OPTIONS.md`
- `docs/external-frontend/EXTERNAL_FRONTEND_DECISION.md`
- `docs/external-frontend/MONOREPO_MIGRATION_PLAN.md`

## Guardrails

- Do not assume external users need Salesforce users if the external app owns auth.
- Do not recommend a privileged operator permission set as the machine identity.
- Do not recommend Convex just because it is trendy; tie it to app-owned data and realtime needs.
- Be explicit about whether Salesforce or the external app is the source of truth for each core domain area.

# Monorepo Migration Plan

## Goal

Describe how this Salesforce repository could evolve into a monorepo if the team decides to build an external web app alongside the current operator platform.

## Recommendation

Adopt a monorepo in stages, not all at once.

That means:

1. keep the current Salesforce DX structure intact
2. define the external app boundary first
3. add monorepo tooling when the external app and backend actually exist

This avoids introducing workspace complexity before there is a second real application to coordinate.

## Why A Monorepo Makes Sense Here

If the external app is built in the same product family, a monorepo can improve:

- shared domain language
- shared validation schemas and API contracts
- coordinated changes across Salesforce, web, and backend layers
- CI visibility for cross-surface changes
- onboarding for a single product team

## Why Not Do It Immediately

The repo currently contains:

- Salesforce packages
- Node-based scripts
- Jest and Playwright tooling for Salesforce development

It does not yet contain:

- a React app
- a backend/BFF
- shared TypeScript packages
- workspace orchestration

So the value of Turborepo only appears once the second and third apps actually exist.

## Recommended Target Structure

```text
.
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── shared-types/
│   ├── api-contracts/
│   └── ui/                  # optional
├── sportsmgmt/
├── sportsmgmt-football/
├── scripts/
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## What Stays Where

### Salesforce packages

Keep these as-is:

- `sportsmgmt/`
- `sportsmgmt-football/`

Do not try to force Salesforce metadata into `apps/` just to match JavaScript conventions. The package roots are already meaningful.

### External web app

Place the customer-facing React app in:

- `apps/web`

### Backend or BFF

Place the external API layer in:

- `apps/api`

If you choose Next.js with server routes, `apps/web` may absorb part of this role at first. If you choose Convex, the backend boundary may be split between `apps/web` and a backend service package.

### Shared packages

Introduce `packages/` only for code genuinely shared across multiple apps:

- `packages/shared-types`
- `packages/api-contracts`
- `packages/ui` if design-system reuse becomes real

Avoid creating shared packages for metadata or one-off utilities.

## Tooling Recommendation

### Package manager

Use `pnpm` workspaces.

Reasons:

- faster installs for multi-package repos
- good fit with Turborepo
- clean workspace semantics

### Task runner

Use Turborepo once the external app is added.

Use it for:

- web builds
- backend tests
- linting across packages
- type-checking shared packages

Do not try to route Salesforce CLI deployment orchestration through Turborepo on day one unless it is actually reducing friction.

## Migration Phases

### Phase 1: Prepare without moving anything

- keep the repo layout unchanged
- choose `pnpm` and Turborepo conventions
- define naming standards for `apps/` and `packages/`
- document how Salesforce packages coexist with app packages

### Phase 2: Add the first external app

- create `apps/web`
- create `apps/api` if a separate backend is chosen
- add workspace tooling at the root
- keep current Salesforce scripts working unchanged

### Phase 3: Add shared contracts

- extract shared request and response schemas
- add common domain constants
- add test helpers for cross-app integration where useful

### Phase 4: CI and deployment split

- separate Salesforce validation jobs from web/backend jobs
- add path-aware CI so unrelated changes do not trigger every pipeline
- document independent deployment workflows

## CI/CD Guidance

Target separate lanes:

- Salesforce metadata validation and tests
- external web app build and tests
- backend/BFF build and tests

Only run full cross-system integration tests where the change actually touches the boundary.

## Risks

- workspace tools can distract from the real architecture work
- shared packages can become premature abstractions
- root scripts may become confusing if both Salesforce and web tooling compete for the same commands

## Decision Rule

Move to a monorepo when both statements are true:

1. the external app has been approved as an active product stream
2. there is at least one shared contract or coordinated delivery path that benefits from being in the same repo

## Bottom Line

Yes, a Turborepo-style monorepo is a good eventual fit. The recommended path is to keep the current Salesforce repo shape intact, then add `apps/web` and any backend package once the external API boundary and first user journeys are defined.

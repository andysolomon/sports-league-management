# W-000016: Division Management — Finalization Plan

## Context

The Division Management feature (branch `feat/W-000016`) is architecturally complete with 28 files changed and 2,937 insertions. The full layered architecture is implemented: IDivision → DivisionWrapper → DivisionRepository → DivisionService → DivisionManagementController → divisionManagement LWC. Test coverage includes 50 Apex test methods and 9 Jest tests.

**Blocking issue:** LWC Jest tests fail with `TypeError: Cannot read properties of undefined (reading 'prototype')` caused by `jest-canvas-mock` v2.5.2 being CJS-only while the project uses ESM (`"type": "module"`). No LWC components use canvas APIs — the dependency is unnecessary.

The next sprint (2025.07) starts 2026-03-17 with Season & Player Management, documented in `docs/SPRINT_2025_07_PLAN.md`.

## Steps

### 1. Fix jest-canvas-mock test failure

- **`jest.config.js`**: Remove `setupFiles: ['jest-canvas-mock']` (line 15)
- **`package.json`**: Remove `"jest-canvas-mock": "^2.5.2"` from devDependencies (line 34)
- Run `npm install` to update lockfile

### 2. Verify all tests pass

```bash
npm run test:unit          # LWC Jest (9 division + existing tests)
npm run lint               # ESLint
npm run prettier:verify    # Formatting
```

### 3. Prevent cursor export files from being committed

- Add `cursor_*.md` to `.gitignore` (the 580KB cursor conversation export is currently untracked)

### 4. Commit the fix

```bash
git add jest.config.js package.json package-lock.json .gitignore
git commit -m "feat(W-000016): Remove unused jest-canvas-mock; fix ESM test failures"
```

### 5. Create PR to main

**Title:** `feat(W-000016): Add Division Management with full CRUD and team assignment`

**PR body covers:**
- Division__c object, full service layer, LWC component
- 50 Apex tests + 9 Jest tests, all passing
- jest-canvas-mock removal fix
- Team-to-division assignment workflow

### 6. Save plan in docs/

Create `docs/W-000016_DIVISION_MANAGEMENT_PLAN.md` with this plan's contents.

## Critical Files

| File | Action |
|------|--------|
| `jest.config.js` | Remove setupFiles entry |
| `package.json` | Remove jest-canvas-mock dep |
| `.gitignore` | Add `cursor_*.md` pattern |
| `docs/W-000016_DIVISION_MANAGEMENT_PLAN.md` | Create plan doc |

## Verification

1. `npm run test:unit` — all Jest tests pass
2. `npm run lint` — no ESLint violations
3. `npm run prettier:verify` — formatting clean
4. Apex tests (if scratch org available): `sf apex test run --tests DivisionManagementControllerTest,DivisionRepositoryTest,DivisionServiceTest --wait 10`
5. PR created and ready for review

# Sprint 6B — `player_attributes_v1` Flag-Flip Readiness Check

**Run date:** 2026-05-03
**Ticket:** WSM-000077
**Agent scope:** automated one-time follow-up; does not have Vercel Analytics or Vercel Flags dashboard access

---

## Result: NOT READY — do not flip

Two blocking conditions failed (QA signoff absent; type-check failing). See details below.

---

## 1. Current flag default

File: `apps/web/src/lib/flags.ts`

```ts
const defaultOn = process.env.NODE_ENV !== "production";

export const playerAttributesV1 = flag<boolean>({
  key: "player_attributes_v1",
  defaultValue: defaultOn,        // → false in production
  decide: () => {
    void trackFlagExposure("player_attributes_v1", defaultOn);
    return defaultOn;             // → false in production
  },
});
```

**Production default: `off` (false).** Flag has not been flipped.

---

## 2. QA signoff status — MISSING

`docs/sprints/SPRINT_6B_VERIFICATION.md` lines 70-79 (flag-flip checklist):

```
- [ ] Preview-deploy manual QA: sign in as admin → open a player's /development → click
      "Add attributes" → paste canonical JSON → confirm chart updates + table row appears
- [ ] Preview-deploy manual QA: open the league detail page → click "Make public" →
      confirm toggle flips + toast appears
- [ ] Preview-deploy manual QA: hit /leagues/[id]/players/[id]/development in an
      incognito window (no Clerk session) → confirm public chart renders
- [ ] Preview-deploy manual QA: flip the same league back to private → confirm public
      route 404s
- [ ] Vercel Analytics Explorer shows player_attributes_view, player_attributes_ingest,
      flag_exposure(player_attributes_v1) events from the preview deploy
- [ ] Soak the flag at on for ≥48h with analytics monitored before declaring Phase 2 shipped
```

All six items are unchecked. Criterion #19 in the criteria matrix is likewise marked `☐ pending preview QA`.

**Git evidence:** `git log --since='2026-04-29' --oneline -- docs/sprints/SPRINT_6B_VERIFICATION.md` returns only the initial creation commit (`5f48cd6` — Sprint 6B closeout, 2026-04-29). No subsequent QA-signoff commit exists.

---

## 3. Repo health checks

### `pnpm install --frozen-lockfile` — PASS

Completed in 11.8s, no lockfile divergence.

### `pnpm --filter @sports-management/web type-check` — FAIL (exit 2)

```
src/app/api/cli/import/route.ts(3,36): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/app/api/players/[id]/route.ts(5,41): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/app/api/players/route.ts(5,41): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/app/api/teams/[id]/route.ts(5,39): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/app/dashboard/_components/player-form.tsx(8,8): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/app/dashboard/_components/team-edit-form.tsx(5,39): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/app/dashboard/import/_components/import-form.tsx(5,36): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/lib/adapters/__tests__/espn-nfl.test.ts(62,44): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(72,44): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(77,44): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(87,14): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(88,20): error TS7006: Parameter 't' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(102,14): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(103,20): error TS7006: Parameter 't' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(107,39): error TS7006: Parameter 'p' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(122,14): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(123,20): error TS7006: Parameter 't' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(125,42): error TS7006: Parameter 'p' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(136,14): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(137,20): error TS7006: Parameter 't' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(140,8): error TS7006: Parameter 'p' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(168,14): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(169,20): error TS7006: Parameter 't' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(200,14): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(201,20): error TS7006: Parameter 't' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(210,14): error TS7006: Parameter 'd' implicitly
  has an 'any' type.
src/lib/adapters/__tests__/espn-nfl.test.ts(211,20): error TS7006: Parameter 't' implicitly
  has an 'any' type.
src/lib/adapters/espn-nfl.ts(1,42): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/lib/adapters/types.ts(1,42): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
src/lib/data-api.ts(23,42): error TS2307: Cannot find module
  '@sports-management/api-contracts' or its corresponding type declarations.
```

**31 errors total.** Root causes:
1. `@sports-management/api-contracts` package is not built/linked — 8 files affected.
2. Implicit `any` in `src/lib/adapters/__tests__/espn-nfl.test.ts` — 23 occurrences; likely pre-existing but was masked if type-check was not running against tests previously.

### `pnpm --filter @sports-management/web lint` — PASS

One pre-existing warning (no new violations):

```
./src/app/dashboard/leagues/[id]/members/member-list.tsx
101:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth.
        Consider using `<Image />` from next/image.  @next/next/no-img-element
```

Exit code 0.

### `pnpm --filter @sports-management/web test:unit` — PASS

```
Test Files  37 passed (37)
     Tests  267 passed (267)
  Duration  6.38s
```

---

## 4. Recommendation

**Owner: two actions required before re-running this check.**

1. **Fix type-check (blocking):** Build or rebuild the `@sports-management/api-contracts` package so it is resolvable from `apps/web` (run `pnpm --filter @sports-management/api-contracts build` or ensure the workspace package is linked). Separately, add explicit types to the implicit-`any` parameters in `src/lib/adapters/__tests__/espn-nfl.test.ts` (lines 62, 72, 77, 87–88, 102–103, 107, 122–123, 125, 136–137, 140, 168–169, 200–201, 210–211).

2. **Complete preview-deploy manual QA (blocking):** Perform all six steps in `docs/sprints/SPRINT_6B_VERIFICATION.md` lines 70-79 against a preview deployment with the flag overridden to `on` via the Vercel Toolbar. Tick each checkbox and commit the updated file to `main` with a message like `docs(sprints): QA signoff — player_attributes_v1 preview QA complete`. That commit is what a future flip-check agent will detect as signoff evidence.

Once both are resolved, re-run this check (`chore/WSM-000077-flip-check`). If both pass, the agent will open the draft flip PR automatically.

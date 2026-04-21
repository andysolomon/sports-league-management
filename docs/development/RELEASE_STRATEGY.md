# Release Strategy

> **Status:** Canonical. Originated as a WSM-000048 spike; ratified in WSM-000053.
> **Last updated:** 2026-04-21

This document is the canonical reference for how sprtsmng cuts releases: which
packages get versioned, what model drives the bump, what triggers a tag, and
where the output lands. Read this first before adding a new workspace package
or a new commit-type rule.

## 1. Versioning Model — Lockstep

All workspace packages bump together, driven from root. One repo-wide tag per
release; every workspace `package.json` carries the same version string.

| Package | Path | Versioned by release |
| --- | --- | --- |
| `sports-management` (root) | `./package.json` | yes — source of truth |
| `@sports-management/web` | `apps/web/package.json` | yes |
| `@sports-management/tui` | `apps/tui/package.json` | yes |
| `@sports-management/api-contracts` | `packages/api-contracts/package.json` | yes |
| `@sports-management/shared-types` | `packages/shared-types/package.json` | yes |

### Why lockstep (not independent)

- Only one deployable product (the monorepo ships as one app). Independent
  versioning optimises for libraries published to multiple consumers, which
  we do not have.
- Shared-types / api-contracts are consumed only by `apps/web` and `apps/tui`
  inside this repo — the `workspace:*` protocol already keeps their versions
  in sync at install time.
- One changelog, one tag, one GitHub Release surface keeps the audit story
  simple for the Salesforce-adjacent reviewers.

Revisit this decision when either condition becomes true:
1. `packages/*` is published to an external registry with outside consumers, or
2. `apps/tui` and `apps/web` ship on divergent cadences.

## 2. Starting Version — 0.1.0 Across The Board

Root `package.json` is reset from the historical `1.0.0` marker to `0.1.0` so
every workspace starts at the same baseline. `apps/tui` advances from `0.0.0`
to `0.1.0` in the same commit.

Rationale: soft launch is targeted for May 2026 (per GTM plan). `1.0.0` is
reserved for that launch and semantic-release will not reach it before then
under the conventional-commits rule set below.

The pre-existing `v0.4.0-tui` lightweight tag is historical only — the next
annotated tag cut by `semantic-release` will be repo-wide (e.g. `v0.2.0`).

## 3. Commit → Version Mapping

| Commit type prefix | semantic-release bump | User-visible? |
| --- | --- | --- |
| `fix:` | patch (0.1.0 → 0.1.1) | yes |
| `perf:` | patch | yes |
| `revert:` | patch | yes |
| `feat:` | minor (0.1.0 → 0.2.0) | yes |
| `feat!:` / `BREAKING CHANGE:` footer | major (0.x.y → 1.0.0) | yes — blocked before launch |
| `docs:` | none | shown in notes |
| `chore:`, `ci:` | none | shown in notes |
| `test:`, `style:`, `refactor:`, `build:` | none | hidden |

Canonical type allowlist — enforced by `commitlint` (WSM-000051, WSM-000052):

```
feat, fix, docs, style, test, chore, revert, perf, refactor, build, ci
```

Scope is **free-form** during Sprint 0. A scope enum will be introduced later
only if drift shows up in the changelog.

### Major-bump guard

Semantic-release will happily cut a `1.0.0` tag on any `feat!:` commit. Until
soft-launch, we treat that as a configuration accident:
- PR reviewers reject breaking-change commits against `main`.
- WSM-000055 (branch protection) is the enforcement point.
- Post-launch we can decide whether to relax this.

## 4. Release Trigger

`main` is the only release branch (`.releaserc.json` → `"branches": ["main"]`).

```
PR merged to main
    → .github/workflows/release.yml runs
    → semantic-release analyses commits since last tag
    → if bump warranted:
        - writes new version to all workspace package.json files
        - commits the bump back to main ("chore(release): vX.Y.Z")
        - creates annotated tag vX.Y.Z
        - publishes GitHub Release with conventional-commits notes
    → else: no-op
```

No tag on push to feature branches. No tag on manual dispatch (future: allow
`workflow_dispatch` for emergency patches).

## 5. `.releaserc.json` Coverage Gap (closed in WSM-000049)

Today `@semantic-release/exec` only rewrites `apps/web/package.json`. Under
lockstep, every workspace `package.json` must be rewritten in the same step.
WSM-000049 extends the `prepareCmd` to cover `apps/tui`, `packages/api-contracts`,
and `packages/shared-types`; the `@semantic-release/git` `assets` list gains
the same four files.

## 6. Branching & Merge

See [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md) (created in WSM-000054).
Summary:
- Branch names: `feat/WSM-XXXXXX-slug`, `fix/WSM-XXXXXX-slug`, `docs/WSM-XXXXXX-slug`, etc.
- PRs squash-and-merge into `main` with a conventional-commit title.
- The squash title is what semantic-release parses — so the PR title, not the
  commit history on the branch, is what drives the bump.
- Force-push to `main` is blocked. Direct push to `main` is blocked.

## 7. Open Questions (deferred, not blocking Sprint 0)

- **Pre-release channel.** Do we want `main` → stable and `next` → pre-release
  once we're past soft launch? Deferred — revisit when QA asks for it.
- **Scope enum.** When the changelog gets noisy, introduce a
  `scope-enum` rule in `commitlint.config.cjs`. Not worth the friction now.
- **`workflow_dispatch` for emergency patches.** Add when we first need it.
- **Publishing `packages/*`.** If/when `api-contracts` or `shared-types` need
  to ship to an external consumer, split them out of the lockstep and switch
  to independent versioning with `@semantic-release/monorepo` or Changesets.

## 8. Decision Log

| Date | Decision | Stories |
| --- | --- | --- |
| 2026-04-17 | Lockstep versioning, all workspace packages | WSM-000048, WSM-000049 |
| 2026-04-17 | Reset root `package.json` from 1.0.0 to 0.1.0 | WSM-000049 |
| 2026-04-17 | Include `apps/tui` in lockstep (historical `v0.4.0-tui` tag stays as-is) | WSM-000049 |
| 2026-04-17 | Commit `scope` is free-form in Sprint 0; revisit if drift appears | WSM-000051 |
| 2026-04-17 | Husky upgrade v7 → v9 in scope of Sprint 0 | WSM-000050 |
| 2026-04-21 | v0.1.0 annotated baseline tag set by hand after an accidental `v1.0.0` from first-release defaults; subsequent releases compute from this baseline | WSM-000049 |
| 2026-04-21 | `Commitlint` job runs on `pull_request`, gating merges; `--no-verify` cannot bypass it | WSM-000052 |

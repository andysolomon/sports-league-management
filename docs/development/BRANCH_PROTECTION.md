# Branch Protection — `main`

> **Status:** Canonical. Authored in WSM-000054. Applied in WSM-000055 (HITL).
> **Last updated:** 2026-04-21

This document is the exact spec that the `main` branch-protection rule must
match. When GitHub's UI or API gets out of sync with this file, this file is
the source of truth — the rule is updated, not the doc.

## 1. Why Protect `main`

Three concrete failure modes we are guarding against:

1. **Poisoned changelog.** A non-conventional commit on `main` breaks
   semantic-release's commit parser for every subsequent release.
2. **Accidental direct push.** `git push origin main` from a local branch
   bypasses CI, review, and the squash-merge rule.
3. **Force-push or delete.** Either would rewrite release history and break
   every downstream clone and the annotated tag chain.

Enforcement stacks — local Husky hook → CI commitlint job → branch
protection — so bypassing one layer still leaves the others. Protection is
the last line.

## 2. Required Rule Set

These settings MUST be enabled on the `main` branch in the
`andysolomon/sports-league-management` repository.

### 2.1 Pull-request requirements

| Setting | Value | Why |
| --- | --- | --- |
| Require a pull request before merging | **on** | No direct push |
| Required approving reviews | **1** | Lightweight solo-maintainer friendly; raise later |
| Dismiss stale approvals on new commits | **on** | Prevents merging unreviewed follow-up commits |
| Require review from Code Owners | **on** | `.github/CODEOWNERS` routes reviews by area |
| Require conversation resolution before merging | **on** | Forces follow-through on review comments |

### 2.2 Required status checks

| Check name | Source | Blocks merge? |
| --- | --- | --- |
| `Commitlint` | `.github/workflows/ci.yml` → job `commitlint` | yes |
| `Lint, Type-check, Test & Build` | `.github/workflows/ci.yml` → job `ci` | yes |

Also on:
- **Require branches to be up to date before merging** — on, so CI results
  reflect the merged state, not a stale feature-branch state.

The check name in GitHub branch-protection settings MUST match the job's
`name:` field exactly, not its key. The job keyed `commitlint:` in
`ci.yml` has `name: Commitlint`, so the required check is `Commitlint`
(not `commitlint`).

### 2.3 Push restrictions

| Setting | Value |
| --- | --- |
| Restrict who can push to matching branches | **on** |
| Allowed actors | the `semantic-release` bypass path (see §3) + repo admins for emergency-only use |
| Block force pushes | **on** (applies to everyone including admins) |
| Block deletions | **on** |

### 2.4 Merge method

GitHub repository settings (not branch-protection, but adjacent):

| Setting | Value |
| --- | --- |
| Allow merge commits | **off** |
| Allow squash merging | **on** (default) |
| Allow rebase merging | **off** |
| Default to pull request title for squash merges | **on** |

Rationale: semantic-release parses the squash-merge commit, which GitHub
generates from the PR title. Rebase-merge would spray N feature-branch
commits onto main; merge-commits would add a second commit per merge that
could be parsed as a no-op. Neither is desired.

## 3. Semantic-Release and Branch Protection

`release.yml` runs on push to `main` and computes the next version.
Historically it also pushed a `chore(release): vX.Y.Z` commit **back to
`main`** (via `@semantic-release/git`), which required a bypass because
every branch-protection rule that mandates a PR rejects direct pushes —
including from `github-actions[bot]`.

**Current approach (post-Sprint 1):** drop the back-push entirely.
`.releaserc.json` no longer includes `@semantic-release/git` or
`@semantic-release/exec`. Release responsibilities are now split:

- `@semantic-release/commit-analyzer` + `@semantic-release/release-notes-generator` — compute version and render notes
- `@semantic-release/npm` (with `npmPublish: false`) — reads `package.json` version only
- `@semantic-release/github` — creates the git tag and GitHub Release via the **REST API**, which bypasses branch protection because it never runs `git push`

Trade-off: `package.json` `version` fields stay frozen (they are not source
of truth; the git tag is). That is acceptable for a repo with
`npmPublish: false` and no downstream consumers reading version from
`package.json`. If we ever need package.json to track the tag, revisit by
installing a GitHub App (see "Historical Option A" below) instead of
re-adding `@semantic-release/git`.

### Historical Option A — GitHub App with bypass (deferred)

Install a GitHub App (e.g. [Release Please Bot] or a custom-scoped App)
with explicit `contents:write` on the repo, add it to the branch-protection
bypass list, and have `release.yml` authenticate as the App. Not needed
while the REST-API-only release flow above covers our needs.

## 4. The `chore(release):` Loop Guard

`release.yml` contains this guard:

```yaml
if: "!contains(github.event.head_commit.message, 'chore(release):')"
```

Historically load-bearing when `@semantic-release/git` pushed a
`chore(release):` commit back to `main`. With the REST-API-only flow
(§3), semantic-release no longer pushes commits to `main`, so the guard
is defensive — it still correctly skips any manual `chore(release):`
commit and any `Revert "chore(release): …"` follow-up. Keep it.

## 5. Applying the Rules (WSM-000055)

Branch protection must be applied via the GitHub UI (Settings → Branches →
Branch protection rules) or via `gh api`:

```bash
gh api -X PUT repos/andysolomon/sports-league-management/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Commitlint", "Lint, Type-check, Test & Build"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

Notes:
- `enforce_admins: false` keeps the Option B admin-bypass path open.
  Set to `true` only once Option A is live.
- `restrictions: null` permits push from any collaborator with write
  access (including the `github-actions[bot]` token used by
  `release.yml`). Tighten once the contributor list grows.
- After applying, verify with
  `gh api repos/andysolomon/sports-league-management/branches/main/protection | jq`.

## 6. Verification Scenarios (WSM-000055 AC)

| # | Action | Expected result |
| --- | --- | --- |
| 1 | Open a PR with all-conventional commits, CI green | Merge button active |
| 2 | Open a PR, CI `Commitlint` red | Merge button disabled |
| 3 | `git push origin main` from a local branch | GitHub rejects with `protected branch` error |
| 4 | `git push --force origin main` (after admin override) | Still rejected (force-push blocked for everyone) |
| 5 | `release.yml` runs after a `feat:` merge | `@semantic-release/github` creates tag + Release via REST API; no direct push to `main` |

## 7. Change History

| Date | Change | Story |
| --- | --- | --- |
| 2026-04-21 | Initial spec authored | WSM-000054 |
| 2026-04-21 | Option B minimal-rules variant applied: force-push blocked, deletion blocked, CODEOWNERS enforced with `required_approving_review_count: 0` (solo-maintainer reality), conversation-resolution required. `required_status_checks` left null so `release.yml` can push back to `main`. Tighten to full spec once a second maintainer is added. | WSM-000055 |
| 2026-04-21 | Dropped `@semantic-release/git` + `@semantic-release/exec` from `.releaserc.json`; Release workflow now uses `@semantic-release/github` only, which creates tags + Releases via REST API and never pushes to `main`. Fixes GH006 rejections that blocked every `feat:` merge during Sprint 1. | fix/release-workflow-branch-protection |

## 8. Applied Configuration (as of 2026-04-21)

Output of `gh api repos/andysolomon/sports-league-management/branches/main/protection`:

```json
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
```

Differences vs §2 spec, tracked for a future tightening pass:

- `required_status_checks` is `null` (spec wants `Commitlint` + main CI required) —
  pending GitHub App bypass (§3 Option A).
- `required_approving_review_count` is `0` (spec wants `1`) — pending second
  maintainer.

[Release Please Bot]: https://github.com/apps/release-please

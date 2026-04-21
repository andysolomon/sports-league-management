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

## 3. The Semantic-Release Bypass

`release.yml` runs on push to `main`, computes the next version, and pushes
a `chore(release): vX.Y.Z` commit **back to `main`**. That push has to
succeed even while branch protection is on.

Two options:

### Option A — `gh-pages`-style GitHub App (recommended long-term)

Install a GitHub App (e.g. [Release Please Bot] or a custom-scoped App)
with explicit `contents:write` on the repo, add it to the allowed-actors
list, and have `release.yml` authenticate as the App instead of using the
default `GITHUB_TOKEN`. This is the textbook solution — no per-repo secret
sprawl, and the audit trail shows the App as the committer.

### Option B — disable the `Required status checks` guard only (temporary)

What we did during Sprint 0 bootstrapping: leave every other protection on,
but remove the `Required status checks` requirement. This lets the default
`GITHUB_TOKEN` push back to `main` because the `chore(release): vX.Y.Z`
commit itself bypasses the status-check gate. Force-push and direct-push
guards stay on.

Decision for Sprint 0: **Option B**. Option A is tracked as a follow-up
(post-launch) because installing a GitHub App is a one-shot admin action
that is disproportionate to the current contributor count (1).

The `release.yml` workflow already has the right `permissions:` block
(`contents: write`, `issues: write`) for Option B.

## 4. The `chore(release):` Loop Guard

`release.yml` contains this guard:

```yaml
if: "!contains(github.event.head_commit.message, 'chore(release):')"
```

That line is load-bearing. Without it, every semantic-release push would
retrigger the workflow, which would compute "no bump since last tag" and
exit cleanly — a small waste, but also a race against any feature push
that arrived in the meantime.

**Known quirk:** the `contains(...)` check also matches any revert commit
whose default message is `Revert "chore(release): …"`. If you ever revert
a release commit manually, the follow-up `release.yml` run is silently
skipped, which is usually what you want (the tag was rolled back; don't
cut a new one).

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
| 5 | `release.yml` pushes `chore(release): vX.Y.Z` to `main` | Push succeeds; new tag created |

## 7. Change History

| Date | Change | Story |
| --- | --- | --- |
| 2026-04-21 | Initial spec authored | WSM-000054 |
| _TBD by HITL_ | Applied via `gh api`; Option B bypass configured | WSM-000055 |

[Release Please Bot]: https://github.com/apps/release-please

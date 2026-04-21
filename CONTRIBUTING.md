# Contributing to sprtsmng

Thanks for contributing. This document covers the three things every change has
to get right: **branch naming**, **commit format**, and **the PR process**.
Everything else (style, tests, architecture) is in the per-package READMEs and
in [CLAUDE.md](./CLAUDE.md).

If you are here to cut a release, read
[docs/development/RELEASE_STRATEGY.md](./docs/development/RELEASE_STRATEGY.md)
first — this file only covers getting a change merged.

## 1. Branch Naming

Every branch maps to a Linear issue in team **ARC**, project
**Sprtsmng Infrastructure** or **Sprtsmng Roster Management**. The issue ID
(e.g. `WSM-000052`) is mandatory.

```
<type>/WSM-XXXXXX-short-slug
```

| Type prefix | Use for |
| --- | --- |
| `feat/` | new user-visible functionality |
| `fix/` | bug fixes |
| `docs/` | documentation only |
| `chore/` | tooling, deps, release plumbing |
| `refactor/` | internal restructure, no behaviour change |
| `test/` | tests only |
| `ci/` | GitHub Actions, workflow changes |

Examples:

```
feat/WSM-000052-commitlint-ci
fix/WSM-000061-league-lookup-null
docs/WSM-000053-contributing
```

The slug is lower-kebab-case, short, and descriptive. It is not parsed by any
tool — it is for humans reading `git branch`.

## 2. Commit Format — Conventional Commits

Commits on your feature branch can be informal. **The squash-merge title is
what matters** — that is what `semantic-release` parses to decide the next
version.

Format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

Allowed types (enforced by [commitlint.config.cjs](./commitlint.config.cjs)):

```
feat, fix, docs, style, test, chore, revert, perf, refactor, build, ci
```

Version bump produced by each type:

| Type | Bump | Shown in changelog |
| --- | --- | --- |
| `feat:` | minor (`0.1.0` → `0.2.0`) | yes |
| `fix:` | patch (`0.1.0` → `0.1.1`) | yes |
| `perf:` | patch | yes |
| `revert:` | patch | yes |
| `feat!:` / `BREAKING CHANGE:` | major (blocked pre-launch) | yes |
| `docs:`, `chore:`, `ci:` | none | yes (notes only) |
| `style:`, `test:`, `refactor:`, `build:` | none | hidden |

Scope is **free-form** today — use it to hint at the area (`ci`, `release`,
`lwc`, `roster`). A scope allowlist will be introduced later if drift shows up.

### Enforcement

Three enforcement layers, in increasing order of un-bypassable-ness:

1. **Local `commit-msg` hook** — [`.husky/commit-msg`](./.husky/commit-msg)
   runs `pnpm commitlint --edit` on every `git commit`.
2. **CI `Commitlint` job** — [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
   re-runs commitlint over the PR commit range. Catches `--no-verify` bypasses.
3. **Branch protection on `main`** — the `Commitlint` check is required to
   merge. See [BRANCH_PROTECTION.md](./docs/development/BRANCH_PROTECTION.md).

If you get a `type-enum` or `type-empty` failure, fix the commit message —
`git commit --amend` locally, or rebase the branch:

```
git rebase -i origin/main   # reword offending commits
git push --force-with-lease
```

Do **not** use `--no-verify`. CI will catch it and the PR will sit red until
the history is clean.

## 3. Pull Request Process

1. **Open a PR against `main`.** The PR title follows the conventional-commit
   format — `feat(scope): subject` — because that is what will become the
   squash-merge commit.
2. **Fill in the body.** Summarise what changed, link the Linear issue
   (`WSM-XXXXXX`), and include Gherkin acceptance scenarios for non-trivial
   changes. The roster/infrastructure plans in `docs/sprints/` show the shape.
3. **Wait for CI green.** Two required checks on `main`:
   - `Commitlint` — validates every commit in the PR range
   - `Lint, Type-check, Test & Build` — the main CI pipeline
4. **Squash-and-merge.** This is the only merge strategy allowed on `main`.
   Rebase-merge and merge-commit both defeat the semantic-release commit parser.
5. **Delete the branch** after merge (the merge UI offers this; CI does not
   require it).
6. **`release.yml` runs automatically** on push to `main`. If the squash title
   warrants a bump (`feat`/`fix`/`perf`/`revert`), a new annotated tag
   `vX.Y.Z` is cut, the GitHub Release is created, and all workspace
   `package.json` files are bumped in a follow-up `chore(release): vX.Y.Z`
   commit. No manual tag-cutting, ever.

## 4. Local Setup Checklist

```
corepack enable
pnpm install         # installs Husky v9 hooks via the `prepare` script
git commit -m "test: confirm commit-msg hook works"  # should succeed
git commit -m "broken message"                        # should fail fast
```

If the second command succeeds, the hook did not install — run
`pnpm install` again and check that `.husky/commit-msg` is executable
(`ls -l .husky/commit-msg` shows `-rwxr-xr-x`).

## 5. Questions

- **"Where is the Linear board?"** — Team ARC, projects
  *Sprtsmng Infrastructure* (platform) and *Sprtsmng Roster Management* (product).
- **"What if my change has no Linear issue?"** — Create one first. Every branch
  name encodes a WSM id.
- **"Can I push directly to `main`?"** — No. Branch protection blocks it.
- **"How do I ship a hotfix faster?"** — Same flow. `fix: …` commits cut a
  patch release within ~2 minutes of merging.

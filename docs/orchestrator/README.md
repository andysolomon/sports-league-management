# Orchestrator Prompts — Claude Code

Copy/paste `/fable-orchestrator` commands for delegating bounded work in `sprtsmng` from the
Claude Code TUI. Fable keeps planning, ambiguity resolution, final judgment, and user
communication in the parent session; workers do the bounded task and report back.

## Files

- [repo-scan.md](repo-scan.md) — map structure, risks, test commands, delegation seams (`codex/analyze`)
- [file-focused-review.md](file-focused-review.md) — review a file/subsystem against invariants (`codex/review`)
- [implementation.md](implementation.md) — turn a bounded task into a safe delegation (`codex/implement` · `composer/implement`)
- [test-strategy.md](test-strategy.md) — find focused verification commands + gaps (`codex/analyze`)

## Before delegating

```
/fable-orchestrator:setup
/fable-orchestrator:observability
```

`setup` checks backend readiness; `observability` shows recent delegated worker runs.

## Applies to every command below

- **Prohibitions:** no commits, pushes, PRs, merges, releases, deploys (Vercel or `convex deploy`),
  destructive scratch-org ops, secret/`.env*` edits, or refactors outside the stated scope.
- **Safe label:** `sprtsmng/<area>/<short-slug>` — e.g. `sprtsmng/apex/division-service`.
- **Verification menu:** Apex `sf apex test run --wait 10 --code-coverage --result-format human` ·
  LWC `pnpm run test:unit` · web unit `pnpm --filter @sports-management/web test:unit` ·
  web types `pnpm --filter @sports-management/web type-check` ·
  web e2e `pnpm --filter @sports-management/web test:e2e` ·
  contracts `pnpm --filter @sports-management/api-contracts build`.

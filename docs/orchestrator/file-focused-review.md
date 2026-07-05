# File / Subsystem Review — `codex/review` (Claude Code)

Copy/paste into the Claude Code TUI. See [README.md](README.md) for shared prohibitions, labels,
and the verification menu.

Apex service/controller review:

```
/fable-orchestrator:orchestrate Review <path e.g. sportsmgmt/main/default/classes/DivisionService.cls> for correctness, ranked most-severe first. Invariants: keep the controller→service→repository→domain-interface layering; new public methods stay `virtual`; services keep constructor DI; controllers keep @TestVisible setters; all classes `with sharing`; org coverage stays ≥90%. Verify with `sf apex test run --tests <Class>Test --wait 10 --code-coverage`. Propose diffs only — no commits/deploys. Label: sprtsmng/apex/<class>/review.
```

Web / Convex review:

```
/fable-orchestrator:orchestrate Review <path under apps/web> for correctness and contract drift. Invariants: Convex writes stay internalMutation (admin-keyed server-side only); keep DTO ⇄ return-validator parity to avoid data-dependent 500s; treat packages/api-contracts as a public contract. Verify with `pnpm --filter @sports-management/web type-check`. Propose diffs only — no commits/deploys. Label: sprtsmng/web/<area>/review.
```

Public-contract change check:

```
/fable-orchestrator:orchestrate Review <path> for breaking changes to public interfaces (IDivision, ITeam, packages/api-contracts). Flag any breakage; do not silently alter contracts. Report only; no edits. Label: sprtsmng/<area>/contract-review.
```

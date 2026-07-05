# Implementation — `codex/implement` · `composer/implement` (Claude Code)

Copy/paste into the Claude Code TUI once Fable has chosen the approach. See [README.md](README.md)
for shared prohibitions, labels, and the verification menu. Keep tasks bounded — one subsystem,
clear spec, named verification.

Bounded Apex change:

```
/fable-orchestrator:orchestrate Implement <bounded change> in <Apex path>. Invariants: keep controller→service→repository→domain-interface layering; new public methods `virtual`; constructor DI; @TestVisible setters; `with sharing`; add/extend tests incl. bulk + negative paths. Verify with `sf apex test run --tests <Class>Test --wait 10 --code-coverage`. Do not commit, push, or deploy — leave changes in the working tree for review. Label: sprtsmng/apex/<class>/impl.
```

Bounded web change:

```
/fable-orchestrator:orchestrate Implement <bounded change> in <apps/web path>. Invariants: Convex writes stay internalMutation; keep DTO ⇄ return-validator parity; respect packages/api-contracts. Verify with `pnpm --filter @sports-management/web type-check` and `pnpm --filter @sports-management/web test:unit`. Do not commit/push/deploy. Label: sprtsmng/web/<area>/impl.
```

Mechanical refactor / migration (Composer default):

```
/fable-orchestrator:orchestrate Apply this mechanical change across <paths>: <spec>. No behavior changes. Verify with the layer's test command. Do not commit/push/deploy or touch unrelated code. Label: sprtsmng/<area>/refactor.
```

Then confirm the delegated run:

```
/fable-orchestrator:observability
```

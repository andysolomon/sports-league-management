# Repo Scan — `codex/analyze` (Claude Code)

Copy/paste into the Claude Code TUI. See [README.md](README.md) for shared prohibitions, labels,
and the verification menu.

Whole-repo map:

```
/fable-orchestrator:orchestrate Scan this repo read-only and map it for delegation: list the Salesforce DX packages (sportsmgmt, sportsmgmt-football) vs the Turborepo TS apps/packages, the real test commands per layer, notable risks, and the best seams to split independent work. Do not edit files, install deps, or deploy. Label: sprtsmng/repo/scan.
```

Scoped to one area:

```
/fable-orchestrator:orchestrate Scan <path> read-only and report its structure, entrypoints, dependencies, and test command. Keep the Salesforce (Apex/LWC) and TS toolchains distinct; do not conflate them. No edits, no deploys. Label: sprtsmng/<area>/scan.
```

Delegation-seam finder before a big change:

```
/fable-orchestrator:orchestrate Read-only: identify independently-workable seams for <change> — isolated Apex services, standalone packages, per-app test suites — and rank them by blast radius. Report only; no edits. Label: sprtsmng/<area>/seams.
```

# Test Strategy — `codex/analyze` (Claude Code)

Copy/paste into the Claude Code TUI before implementing. See [README.md](README.md) for shared
prohibitions, labels, and the verification menu.

Find the narrowest verification for a planned change:

```
/fable-orchestrator:orchestrate Read-only: for a change to <paths>, identify the narrowest verification commands and any coverage gaps. Match tool to layer — Apex→`sf apex test`, LWC→Jest (`pnpm run test:unit`), web/tui/packages→Vitest, browser flows→Playwright. Do not propose a runner a package doesn't declare; keep Salesforce and TS verification separate. Report commands + gaps only; no edits. Label: sprtsmng/<area>/test-strategy.
```

Coverage-gap hunt for a subsystem:

```
/fable-orchestrator:orchestrate Read-only: audit <subsystem> for missing test coverage — untested negative paths, bulk/governor-limit cases (Apex), or unvalidated DTO shapes (web). List gaps ranked by risk; do not write tests. Label: sprtsmng/<area>/coverage-gaps.
```

Guardrail check before a PR:

```
/fable-orchestrator:orchestrate Read-only: list which repo guardrails apply to <paths> — `pnpm run lint`, `pnpm run prettier:verify`, `pnpm run check:env`, `pnpm run check:css` — and why. Report only. Label: sprtsmng/<area>/guardrails.
```

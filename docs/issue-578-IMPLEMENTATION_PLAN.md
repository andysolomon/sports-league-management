# Issue 578 — Verify navigation architecture and compatibility end to end

## 1. Product goal and scope boundaries

Produce a verifiable answer to the question: **does the shipped Wayfinder navigation architecture satisfy every requirement in `docs/design/navigation-asr.md` and the navigation-relevant sections of `CONTEXT.md`, without regressing the legacy compatibility surface or the existing test suites?**

This issue is **verification, not implementation**. It must result in an evidence map, not code changes (unless a strictly necessary new test is required to make an assertion runnable — surfaced in the matrix as a Follow-up row).

**In scope**
- Read `docs/design/navigation-asr.md`, `CONTEXT.md` (Canonical Models, Redirects & 404 Rules, Active League Sync, Visual Continuity, Settings), and the ADRs.
- Inventory the navigation surface at `apps/web/src/app/dashboard/**`, `apps/web/src/components/workspace/**`, and the supporting libs at `apps/web/src/lib/**`.
- Inventory navigation tests at `apps/web/src/app/dashboard/_components/__tests__/**`, `apps/web/src/components/workspace/__tests__/**`, `apps/web/e2e/tests/**`.
- Run focused local checks (`pnpm vitest run`, `tsc --noEmit`) and capture the latest CI conclusions for the `CI` and `E2E` workflows on `main`.
- Persist the evidence as `docs/issue-578-verification-matrix.md`.
- Surface any gap as a follow-up issue row in the matrix (not a silent skip).

**Out of scope**
- Editing source code beyond necessary new tests (call out as Follow-up if needed).
- Visual/UX redesign or page-content changes.
- Re-opening or amending shipped PRs (#570–#576).

## 2. Source-of-truth references

| Requirement cluster | File | Notes |
| --- | --- | --- |
| Acceptance criteria | `docs/design/navigation-asr.md` | ASR-1..25 + Redirect/404 rules + Active League sync rules |
| Workspace destination language | `CONTEXT.md` | Naming, "League Workspace" / "Active League" semantics |
| Decisions | `docs/adr/0001-*`, `docs/adr/0002-*` | Canonical ownership + resource IDs |

## 3. Evidence strategy

1. **Static evidence**: every ASR cluster mapped to ≥1 in-code marker (`ASR-NN` comments) or test path/line.
2. **Local evidence**: focused unit suites (vitest) at HEAD; `tsc --noEmit` clean.
3. **CI evidence**: latest green `CI` and `E2E` runs on `main` per workflow.
4. **Gap evidence**: any ASR row lacking focused coverage is recorded with status `Partial` and a proposed Follow-up issue.

## 4. Milestones

### Phase 1 — Build the matrix
- Walk every ASR row, gather ≥1 evidence pointer (file/line or test id), record status.
- Include Redirect/404 rules and Active League sync rules as additional rows.

### Phase 2 — Run focused local checks
- `pnpm --filter @sports-management/web exec vitest run` (capture in progress file).
- `pnpm --filter @sports-management/web exec tsc --noEmit` (capture in progress file).

### Phase 3 — Fetch CI conclusions
- `gh run list --workflow=E2E --branch=main --limit=1` + `gh run view <id> --json jobs` → record per-job conclusion.
- `gh run list --workflow=CI --branch=main --limit=1` + per-job conclusion.

### Phase 4 — Follow-up surfacing
- For each `Partial` row, draft a Follow-up row mapping back to the Wayfinder epic #569.
- Goal: every non-`Pass` row has a clear owner + path to close; do **not** implement fixes in #578.

## 5. Immediate next steps

1. Land this plan + matrix + progress on a docs-only branch (`docs/issue-578-verification`).
2. File four follow-up GitHub issues under epic #569 for the four `Partial` ASRs (parent step).
3. Once matrix is green or all gaps are tracked under #569, close #578 and #569.

## 6. Re-verification strategy (per release)

The matrix is a point-in-time artifact. For every release after #578 closes, re-run Phase 2 (vitest + tsc) and Phase 3 (CI conclusions) and add a dated row at the bottom of `docs/issue-578-verification-matrix.md`. Any new `Partial`/`Follow-up` row counts toward a fresh follow-up under #569.

## Implementation Plan (task checklist)

**Story:** #578 Verify navigation architecture and compatibility end to end  
**Branch:** `docs/issue-578-verification`

### Tasks

- [x] 1.0 - Inventory navigation surface + tests at HEAD
- [x] 2.0 - Build docs/issue-578-verification-matrix.md (Pass/Partial/Follow-up per ASR)
- [x] 3.0 - Run focused vitest + tsc at HEAD; capture in docs/issue-578-progress.txt
- [x] 4.0 - Fetch CI + E2E workflow conclusions on main; capture in matrix
- [x] 5.0 - Map every Partial row to a follow-up issue under epic #569 (no fixes here)
- [ ] 6.0 - Ship docs-only PR; close #578 once green; close #569 when all gaps tracked

### Acceptance Criteria Mapping

| Criterion | Task(s) | How Verified |
| --- | --- | --- |
| Every ASR has evidence | 1, 2 | Matrix exists |
| Local checks green at HEAD | 3 | Progress file lines |
| CI conclusions captured | 4 | Matrix CI row |
| Partial rows surfaced as follow-ups (not silent passes) | 5 | `Follow-up` column populated |

### Risks & Notes

- Visual regression job is non-blocking; recorded as `fail` historically; do not weight it against #578.
- Avoid double-counting shipped PRs; matrix evidence must point at merged code, not PRs.

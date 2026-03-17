---
name: organize-docs
description: Organizes project documentation into the established docs subfolders, repairs moved-file references, and refreshes docs navigation. Use when the user wants docs reorganized, grouped, moved, cleaned up, or when new docs should follow the repo's docs structure.
---

# Organize Docs

## Use This Skill When

- docs have accumulated in the `docs/` root
- the user wants documents grouped into folders
- a task creates new planning or guide docs and they should follow repo structure
- links or script references may need repair after doc moves

## Target Structure

Use the existing project layout:

- `docs/agile/`
- `docs/external-frontend/`
- `docs/guides/`
- `docs/sprints/`
- `docs/work-items/`

## Workflow

1. Inventory current docs with `Glob`.
2. Classify each file by purpose:
   - Agile tooling or workflow docs -> `docs/agile/`
   - user/dev/testing/reference guides -> `docs/guides/`
   - sprint plans -> `docs/sprints/`
   - story-specific plans -> `docs/work-items/`
   - external app/auth/monorepo exploration -> `docs/external-frontend/`
3. Move files into their target folders.
4. Search the repo for stale `docs/...` references with `rg`.
5. Update any scripts, skill docs, sprint docs, or work-item docs that still point to old paths.
6. Add or refresh `docs/README.md` if navigation would benefit from an index.
7. Validate with one final `rg` pass for old paths and run `ReadLints` on changed docs.

## Guardrails

- Keep filenames stable unless the user explicitly asks for renaming.
- Treat hooks, skills, and scripts as first-class references that must be updated when paths change.
- Ignore transcript/export artifacts unless the user explicitly asks to clean them up.
- Prefer a small number of clear category folders over deep nesting.

## Deliverable

Leave the repo with:

- docs grouped into the agreed folder structure
- stale references updated
- a short summary of what moved and what was updated

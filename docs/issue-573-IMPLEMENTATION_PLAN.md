# Issue 573 — Teams Home and Divisions consolidation

## Delivered scope

- Teams Home now renders Teams at `/dashboard/teams` and Divisions at
  `/dashboard/teams?view=divisions`; selecting a Division adds
  `&division=[id]` and uses normal link history.
- The existing Division standings, empty states, active-season behavior,
  feature-gated standings shortcut, and org-admin CRUD controls remain in the
  Divisions view.
- Team Home is the primary directory action. Team Quick View remains available
  only through its explicit labelled button.
- Legacy Division routes validate access (and synchronize the owning Active
  League for a Division detail) before permanently redirecting. Invalid or
  inaccessible Division IDs remain non-disclosing 404s.
- Desktop and mobile sidebar navigation no longer advertises a standalone
  Divisions destination. First-party in-scope Division links use Teams Home.

## Explicitly deferred

- Command palette canonicalization (#577)
- Generic `?from=` removal (#574)
- Season route ownership (#575)
- Settings, billing, and import navigation (#576)

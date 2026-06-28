# Dashboard UI kit

High-fidelity recreation of the Sports League **Discover** view — the league
discovery surface where an operator browses public leagues and adds teams to
their dashboard.

## Files

- `index.html` — self-contained, interactive recreation (React + Babel via CDN,
  linking the real `styles.css`). Click divisions to expand, add/remove teams,
  switch nav, toggle light/dark. This is the canvas thumbnail and the
  click-through starting point.
- `DiscoverScreen.jsx` — the same screen composed from the published
  design-system components (`Button`, `Badge`, `Card`, `NavItem`, `Search`,
  `Avatar`, `Breadcrumb`, `PageHeader`, `Icon`). Use this as the reference for
  composition in a real React app.

## Surfaces covered

- **App shell** — fixed sidebar (logo + 8 nav items, one active), top bar
  (league switcher, ⌘K search, theme toggle, avatar).
- **Discover content** — breadcrumb, page header, league cards with division
  accordions and add/added team chips.

## Notes

This is a visual + interaction recreation, not production code — state is local
and data is mocked. It composes the system's component primitives rather than
re-implementing them.

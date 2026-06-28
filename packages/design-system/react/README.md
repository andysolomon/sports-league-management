# Sports League — Design System (React)

Production React + TypeScript implementation of the Sports League design
system. Zero runtime dependencies beyond React. Theming (light/dark, accent,
radius) is driven entirely by CSS variables — no CSS-in-JS, no build step
beyond your bundler.

## Install

Copy the `react/` folder into your project. Import the stylesheet once at your
entry point:

```tsx
import '@/sportsleague/tokens.css';
```

## Usage

```tsx
import { ThemeProvider, useTheme, Button, Badge, Card, Stat } from '@/sportsleague/src';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" defaultAccent="green">
      <Dashboard />
    </ThemeProvider>
  );
}

function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Card>
      <Stat value="413" label="Teams" />
      <Button variant="primary" icon="plus">New Season</Button>
      <Badge variant="success" icon="check">All added</Badge>
      <button onClick={toggleTheme}>Theme: {theme}</button>
    </Card>
  );
}
```

## Theming

`<ThemeProvider>` writes three data attributes onto a `.sl-root` wrapper, and
every component reads CSS variables from there:

| Attribute      | Values                                   | Default   |
| -------------- | ---------------------------------------- | --------- |
| `data-theme`   | `light` · `dark`                         | `dark`    |
| `data-accent`  | `green` · `blue` · `violet` · `orange`   | `green`   |
| `data-round`   | `sharp` · `default` · `soft`             | `default` |

Change them at runtime via `useTheme()` (`setTheme`, `toggleTheme`, `setAccent`,
`setRound`). Because it's all CSS variables, nested subtrees can override the
theme by rendering another `.sl-root` with different attributes.

### Tokens

Semantic, not literal — components reference the name, never the hex.

```
--bg --surface --surface-2 --surface-3            surfaces
--border --border-strong                          lines
--text --text-muted --text-subtle                 text ranks
--primary --primary-fg --primary-hover            high-contrast action
--accent --accent-soft                            success / live data
--danger --danger-strong                          destructive
--r --r-lg                                         radius
--space-1 … --space-10                             4px spacing grid
```

## Components

`Button` · `IconButton` · `Badge` · `Input` · `Select` · `Search` · `Switch` ·
`Checkbox` · `Radio` · `Card` · `Stat` · `NavItem` · `Tabs` · `Segmented` ·
`Banner` · `Avatar` · `Table` · `Breadcrumb` · `PageHeader` · `Icon`

All are typed; props extend the matching native element where it makes sense
(`ButtonProps extends React.ButtonHTMLAttributes<…>`), so `onClick`, `disabled`,
`aria-*`, etc. pass straight through.

## Files

```
react/
  tokens.css              all CSS variables + component classes
  src/
    theme.tsx             ThemeProvider + useTheme()
    icons.tsx             Icon component + icon set
    components.tsx        every component
    index.ts              barrel export
  examples/
    DiscoverScreen.tsx    full screen composed from components
    App.tsx               mounts the provider + theme/accent controls
```

## Example screen

`examples/DiscoverScreen.tsx` rebuilds the Discover view (sidebar, topbar,
league cards, division accordions, team chips) from the components above — a
reference for composition and a smoke test that the tokens hold up in context.

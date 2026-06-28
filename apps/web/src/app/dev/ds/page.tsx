"use client";

/*
 * Live demo that the `@sports-management/design-system` workspace package is
 * wired into the web app. It renders the package's own React components
 * (the `.sl-*` library — distinct from the app's shadcn `ui/*` primitives on
 * /dev/ui) inside a `.sl-root` wrapper.
 *
 * Styling: we import ONLY the namespaced component classes from the package
 * plus a small token bridge (sl-bridge.css) — see that file for why we don't
 * import the package's global styles.css. Theme follows the app (next-themes
 * toggles `.dark` on <html>), so the toggle top-right drives these too.
 */
import {
  Badge,
  Banner,
  Button,
  Card,
  IconButton,
  Input,
  Stat,
} from "@sports-management/design-system";
import { ThemeToggle } from "@/components/theme-toggle";

// The package ships namespaced `.sl-*` classes; safe to import app-wide.
import "@sports-management/design-system/tokens/components.css";
// Supplies the few tokens the app doesn't already define, scoped to .sl-root.
import "./sl-bridge.css";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h2 className="sl-mono" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignSystemPackageDemoPage() {
  return (
    <div className="sl-root" data-accent="green" style={{ minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 40 }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.7px" }}>
              @sports-management/design-system
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
              The standalone design-system package, rendered live inside the web
              app. Toggle the theme top-right →
            </p>
          </div>
          <ThemeToggle />
        </header>

        <Section title="01 — Buttons">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <Button variant="primary" icon="plus">New Season</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon="trash">Delete</Button>
            <IconButton icon="search" aria-label="Search" />
          </div>
        </Section>

        <Section title="02 — Badges">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="solid">Solid</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success" dot>Active</Badge>
            <Badge variant="danger" icon="alert">Failed</Badge>
          </div>
        </Section>

        <Section title="03 — Stats">
          <Card style={{ display: "flex", gap: 32, padding: 20 }}>
            <Stat value="413" label="Teams" />
            <Stat value="2,929" label="Players" accent />
            <Stat value="32" label="Divisions" />
          </Card>
        </Section>

        <Section title="04 — Input">
          <div style={{ maxWidth: 360 }}>
            <Input placeholder="Allatoona Buccaneers" />
          </div>
        </Section>

        <Section title="05 — Banner">
          <div style={{ display: "grid", gap: 10 }}>
            <Banner variant="success">Last sync complete · 2,929 players updated</Banner>
            <Banner variant="danger">Build failed. Bundle exceeds 50 MB.</Banner>
          </div>
        </Section>
      </div>
    </div>
  );
}

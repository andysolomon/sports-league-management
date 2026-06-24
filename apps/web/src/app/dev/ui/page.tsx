"use client";

/*
 * Design system kitchen sink + token reference.
 *
 * The living reference for the Sports League design system: the 12 semantic
 * color tokens, the type scale, the radius family, and the shadcn `ui/*`
 * primitives that consume them — rendered in whichever theme is active (toggle
 * top-right). Dev-only; not linked from nav.
 */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/theme-toggle";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

// The 12 semantic color tokens — each resolves to a light and a dark value;
// components reference the name, never the hex.
const COLOR_TOKENS: { name: string; cls: string; role: string }[] = [
  { name: "--bg", cls: "bg-bg", role: "App background" },
  { name: "--surface", cls: "bg-surface", role: "Card surface" },
  { name: "--surface-2", cls: "bg-surface-2", role: "Inset / secondary fill" },
  { name: "--surface-3", cls: "bg-surface-3", role: "Hover / pressed" },
  { name: "--border", cls: "bg-border", role: "Hairline border" },
  { name: "--border-strong", cls: "bg-border-strong", role: "Control border" },
  { name: "--text", cls: "bg-text", role: "Primary text" },
  { name: "--text-muted", cls: "bg-text-muted", role: "Secondary text" },
  { name: "--text-subtle", cls: "bg-text-subtle", role: "Hint / disabled" },
  { name: "--primary", cls: "bg-primary", role: "High-contrast action" },
  { name: "--accent", cls: "bg-accent", role: "Success / live data" },
  { name: "--danger", cls: "bg-danger", role: "Destructive" },
];

// name · size/line-height · the Tailwind text-* utility that carries all three.
const TYPE_SCALE: { name: string; cls: string; sample: string }[] = [
  { name: "display-32 · 32/38 · 700", cls: "text-display-32", sample: "Discover Leagues" },
  { name: "stat-30 · 30/32 · 700", cls: "text-stat-30", sample: "413 Teams" },
  { name: "title-22 · 22/28 · 700", cls: "text-title-22", sample: "Cobb County Football" },
  { name: "heading-18 · 18/24 · 600", cls: "text-heading-18", sample: "Player Roster" },
  { name: "body-15 · 15/23 · 400", cls: "text-body-15", sample: "Browse leagues and add teams to your dashboard." },
  { name: "label-14 · 14/20 · 500", cls: "text-label-14", sample: "Add Player" },
  { name: "caption-12 · 12/16 · 500", cls: "text-caption-12", sample: "City · Acworth" },
  { name: "mono-13 · 13/18 · 500", cls: "text-mono-13 font-mono", sample: "sprtsmng.dev ⌘K" },
];

const RADII: { name: string; cls: string; px: string }[] = [
  { name: "control", cls: "rounded-control", px: "10px" },
  { name: "card", cls: "rounded-card", px: "14px" },
  { name: "pill", cls: "rounded-full", px: "full" },
];

export default function UiKitchenSinkPage() {
  return (
    <div className="min-h-screen px-6 py-10 font-sans">
      <div className="mx-auto max-w-4xl space-y-12">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-display-32 text-foreground">The design system</h1>
            <p className="text-body-15 text-text-muted">
              One token set, two themes · Hanken Grotesk / JetBrains Mono · 4px
              grid. Toggle the theme top-right →
            </p>
          </div>
          <ThemeToggle />
        </header>

        <Section title="01 — Color tokens">
          <div className="overflow-hidden rounded-card border border-border">
            {COLOR_TOKENS.map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-4 border-b border-border px-4 py-2.5 last:border-b-0"
              >
                <span
                  className={`h-7 w-7 shrink-0 rounded-md border border-border ${t.cls}`}
                />
                <span className="w-40 font-mono text-mono-13 text-foreground">
                  {t.name}
                </span>
                <span className="text-label-14 text-text-muted">{t.role}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="02 — Typography">
          <div className="space-y-4">
            {TYPE_SCALE.map((t) => (
              <div
                key={t.name}
                className="flex items-baseline justify-between gap-6 border-b border-border pb-3 last:border-b-0"
              >
                <span className={`${t.cls} text-foreground`}>{t.sample}</span>
                <span className="shrink-0 font-mono text-caption-12 text-text-subtle">
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="03 — Radius">
          <div className="flex flex-wrap gap-6">
            {RADII.map((r) => (
              <div key={r.name} className="space-y-2 text-center">
                <div
                  className={`h-20 w-20 border border-border-strong bg-surface-2 ${r.cls}`}
                />
                <div className="font-mono text-mono-13 text-foreground">
                  {r.name}
                </div>
                <div className="font-mono text-caption-12 text-text-subtle">
                  {r.px}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="04 — Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="05 — Badges & status">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success">Active</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </Section>

        <Section title="06 — Form controls">
          <div className="grid max-w-md gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ks-name">Team name</Label>
              <Input id="ks-name" placeholder="Allatoona Buccaneers" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ks-div">Division</Label>
              <Select>
                <SelectTrigger id="ks-div">
                  <SelectValue placeholder="Select a division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4a">Class 4A</SelectItem>
                  <SelectItem value="5a">Class 5A</SelectItem>
                  <SelectItem value="6a">Class 6A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="07 — Card">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Cobb County Football</CardTitle>
              <CardDescription>16 schools · 3 divisions</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Hairline borders, soft corners, monochrome surface. Emphasis comes
              from contrast and weight, not hue.
            </CardContent>
          </Card>
        </Section>

        <Section title="08 — Table">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead className="text-right">SPRT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Allatoona", "Class 6A", 88],
                  ["Harrison", "Class 6A", 84],
                  ["Kennesaw Mountain", "Class 5A", 81],
                ].map(([team, div, ovr]) => (
                  <TableRow key={team as string}>
                    <TableCell className="font-medium">{team}</TableCell>
                    <TableCell className="text-muted-foreground">{div}</TableCell>
                    <TableCell className="text-right font-mono">{ovr}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Section>

        <Section title="09 — Skeleton & separator">
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-72" />
            <Separator />
            <Skeleton className="h-24 w-full" />
          </div>
        </Section>
      </div>
    </div>
  );
}

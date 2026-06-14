"use client";

/*
 * WSM-000136 P1 — Professional theme kitchen sink.
 *
 * Renders the base shadcn `ui/*` primitives inside `.theme-pro` (monochrome
 * dark) so the new design language can be reviewed in isolation, without
 * touching the live 8bit-themed pages. Dev-only; not linked from nav.
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function UiKitchenSinkPage() {
  return (
    <div className="theme-pro min-h-screen px-6 py-10 font-sans">
      <div className="mx-auto max-w-4xl space-y-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Design system — professional theme
          </h1>
          <p className="text-sm text-muted-foreground">
            WSM-000136 P1 · monochrome, dark-first · base shadcn/ui primitives
            scoped to <code className="font-mono">.theme-pro</code>.
          </p>
        </header>

        <Section title="Buttons">
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

        <Section title="Badges (status uses semantic color only)">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </Section>

        <Section title="Form controls">
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

        <Section title="Card">
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

        <Section title="Table">
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

        <Section title="Skeleton & separator">
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

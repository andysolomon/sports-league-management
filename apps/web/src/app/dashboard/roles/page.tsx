import Link from "next/link";
import { Check, Minus, ArrowLeft } from "lucide-react";
import { ORG_ROLES, roleLabel } from "@/lib/permissions";
import {
  capabilityGrid,
  ROLE_SUMMARIES,
} from "@/lib/roles-matrix";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = {
  title: "Roles & permissions",
};

export default function RolesPage() {
  const grid = capabilityGrid();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-foreground">
          Roles &amp; permissions
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Everyone in your organization has one of three roles. This is exactly
          what each can do — use it to decide who to assign which role.
        </p>
      </div>

      {/* Role summaries */}
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLE_SUMMARIES.map((s) => (
          <Card key={s.role}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{roleLabel(s.role)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{s.blurb}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Capability matrix */}
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Capability</TableHead>
              {ORG_ROLES.map((role) => (
                <TableHead key={role} className="text-center">
                  {roleLabel(role)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grid.map((row) => (
              <TableRow key={row.label}>
                <TableCell>
                  <span className="font-medium text-foreground">
                    {row.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {row.detail}
                  </span>
                </TableCell>
                {ORG_ROLES.map((role) => (
                  <TableCell key={role} className="text-center">
                    {row.allowed[role] ? (
                      <Check
                        className="mx-auto h-4 w-4 text-green-500"
                        aria-label="Allowed"
                      />
                    ) : (
                      <Minus
                        className="mx-auto h-4 w-4 text-muted-foreground/40"
                        aria-label="Not allowed"
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* New-member default */}
      <Card className="border-primary/30">
        <CardContent className="py-4 text-sm text-muted-foreground">
          New members join as <strong className="text-foreground">Viewer</strong>{" "}
          — the least-privilege default. Only an{" "}
          <strong className="text-foreground">Admin</strong> can promote someone
          to Coach or Admin, from the league&rsquo;s Members page.
        </CardContent>
      </Card>
    </div>
  );
}

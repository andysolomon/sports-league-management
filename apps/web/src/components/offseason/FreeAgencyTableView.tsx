import Link from "next/link";
import { gradeToClassYear } from "@/lib/class-year";
import type { FreeAgentRow } from "@/lib/offseason-free-agency";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface FreeAgencyTableViewProps {
  agents: FreeAgentRow[];
  canSign: boolean;
  signLabel: (agent: FreeAgentRow) => string;
  onSignClick?: (agent: FreeAgentRow) => void;
}

export function FreeAgencyTableView({
  agents,
  canSign,
  signLabel,
  onSignClick,
}: FreeAgencyTableViewProps) {
  if (agents.length === 0) {
    return (
      <p
        className="py-8 text-center text-sm text-muted-foreground"
        data-testid="free-agency-empty"
      >
        No free agents match the current filters.
      </p>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto" data-testid="free-agency-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Pos</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Overall</TableHead>
            {canSign && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/players/${agent.id}`}
                  className="hover:underline"
                >
                  {agent.name}
                </Link>
              </TableCell>
              <TableCell>{agent.position}</TableCell>
              <TableCell>{gradeToClassYear(agent.grade) ?? "—"}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {agent.overall != null ? agent.overall : "—"}
              </TableCell>
              {canSign && (
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onSignClick?.(agent)}
                  >
                    {signLabel(agent)}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

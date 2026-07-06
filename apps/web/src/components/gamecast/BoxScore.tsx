import type { BoxScoreAtPosition } from "@/lib/gamecast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface BoxScoreTeam {
  abbr: string;
}

export interface BoxScoreProps {
  data: BoxScoreAtPosition;
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
}

type StatKey = "total" | "pass" | "rush" | "first" | "to" | "plays";

const ROWS: ReadonlyArray<{ label: string; key: StatKey }> = [
  { label: "Total yards", key: "total" },
  { label: "Passing", key: "pass" },
  { label: "Rushing", key: "rush" },
  { label: "First downs", key: "first" },
  { label: "Turnovers", key: "to" },
  { label: "Off. plays", key: "plays" },
];

export default function BoxScore({
  data,
  homeTeam,
  awayTeam,
}: BoxScoreProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-text-muted">Team stats</TableHead>
          <TableHead className="text-right font-mono text-caption-12 font-bold text-foreground">
            {homeTeam.abbr}
          </TableHead>
          <TableHead className="text-right font-mono text-caption-12 font-bold text-foreground">
            {awayTeam.abbr}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.key} className="hover:bg-transparent">
            <TableCell className="text-text-muted">{row.label}</TableCell>
            <TableCell className="text-right font-mono text-caption-12 font-bold tabular-nums">
              {data.home[row.key]}
            </TableCell>
            <TableCell className="text-right font-mono text-caption-12 font-bold tabular-nums">
              {data.away[row.key]}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

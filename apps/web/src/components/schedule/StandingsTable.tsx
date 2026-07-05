import Link from "next/link";
import type { Standing } from "@sports-management/shared-types";

export interface StandingsTableProps {
  rows: Standing[];
  /** When set, renders a division header above this table block. */
  divisionName?: string;
}

/**
 * Pure server component — renders a Standing[] as the canonical
 * 8-bit standings table. Re-used by the org-gated page (WSM-000072)
 * and the public viewer (WSM-000073), so any shape changes ripple to
 * both surfaces in one place.
 */
export default function StandingsTable({
  rows,
  divisionName,
}: StandingsTableProps) {
  return (
    <div className="w-full">
      {divisionName ? (
        <h3 className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-semibold text-foreground">
          {divisionName}
        </h3>
      ) : null}
      {/* Nine columns never fit a phone — scroll the table inside its own
          container instead of widening the page (WSM-000085). */}
      <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border bg-muted text-left">
            <th className="px-4 py-2 font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              Rank
            </th>
            <th className="px-4 py-2 font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              Team
            </th>
            <th className="px-4 py-2 text-right font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              W
            </th>
            <th className="px-4 py-2 text-right font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              L
            </th>
            <th className="px-4 py-2 text-right font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              T
            </th>
            <th className="px-4 py-2 text-right font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              PF
            </th>
            <th className="px-4 py-2 text-right font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              PA
            </th>
            <th className="px-4 py-2 text-right font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              +/−
            </th>
            <th className="px-4 py-2 text-right font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
              Div Rank
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const diff = row.pointsFor - row.pointsAgainst;
            return (
              <tr key={row.teamId} className="border-b border-border">
                <td className="px-4 py-2 font-mono tabular-nums text-foreground">
                  {row.leagueRank}
                </td>
                <td className="px-4 py-2 text-foreground">
                  <Link
                    href={`/dashboard/teams/${row.teamId}`}
                    className="text-primary hover:underline"
                  >
                    {row.teamName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
                  {row.wins}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
                  {row.losses}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
                  {row.ties}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
                  {row.pointsFor}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
                  {row.pointsAgainst}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono tabular-nums ${
                    diff > 0
                      ? "text-accent"
                      : diff < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {diff > 0 ? "+" : ""}
                  {diff}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">
                  {row.divisionRank}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

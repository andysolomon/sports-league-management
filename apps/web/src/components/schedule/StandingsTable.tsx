import type { Standing } from "@sports-management/shared-types";

export interface StandingsTableProps {
  rows: Standing[];
}

/**
 * Pure server component — renders a Standing[] as the canonical
 * 8-bit standings table. Re-used by the org-gated page (WSM-000072)
 * and the public viewer (WSM-000073), so any shape changes ripple to
 * both surfaces in one place.
 */
export default function StandingsTable({ rows }: StandingsTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b-2 border-border bg-muted text-left text-foreground">
          <th className="px-4 py-2 font-mono text-xs uppercase">Rank</th>
          <th className="px-4 py-2 font-mono text-xs uppercase">Team</th>
          <th className="px-4 py-2 text-right font-mono text-xs uppercase">W</th>
          <th className="px-4 py-2 text-right font-mono text-xs uppercase">L</th>
          <th className="px-4 py-2 text-right font-mono text-xs uppercase">T</th>
          <th className="px-4 py-2 text-right font-mono text-xs uppercase">PF</th>
          <th className="px-4 py-2 text-right font-mono text-xs uppercase">PA</th>
          <th className="px-4 py-2 text-right font-mono text-xs uppercase">+/−</th>
          <th className="px-4 py-2 text-right font-mono text-xs uppercase">
            Div Rank
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const diff = row.pointsFor - row.pointsAgainst;
          return (
            <tr key={row.teamId} className="border-b border-border">
              <td className="px-4 py-2 font-mono text-foreground">
                {row.leagueRank}
              </td>
              <td className="px-4 py-2 text-foreground">{row.teamName}</td>
              <td className="px-4 py-2 text-right font-mono text-foreground">
                {row.wins}
              </td>
              <td className="px-4 py-2 text-right font-mono text-foreground">
                {row.losses}
              </td>
              <td className="px-4 py-2 text-right font-mono text-foreground">
                {row.ties}
              </td>
              <td className="px-4 py-2 text-right font-mono text-foreground">
                {row.pointsFor}
              </td>
              <td className="px-4 py-2 text-right font-mono text-foreground">
                {row.pointsAgainst}
              </td>
              <td
                className={`px-4 py-2 text-right font-mono ${
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
              <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                {row.divisionRank}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

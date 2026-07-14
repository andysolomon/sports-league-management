import { Fragment } from "react";
import Link from "next/link";
import type { Standing } from "@sports-management/shared-types";
import { Badge } from "@/components/ui/badge";
import { TeamMark } from "@/components/team-mark";

export interface StandingsTableProps {
  rows: Standing[];
  /** When set, renders a division header above this table block. */
  divisionName?: string;
  /**
   * WSM-000250 dashboard polish — season playoff team count. Rows ranked at
   * or above the cut (that have played) get a "Clinched" badge. Optional and
   * off by default so the public viewer and visual harness stay unchanged.
   */
  playoffCut?: number;
  /**
   * Render the dashed "Playoff cut" divider under the row whose league rank
   * equals `playoffCut`. Only meaningful when rows are league-rank ordered
   * (the flat league table) — division tables pass `playoffCut` alone.
   */
  showPlayoffCutDivider?: boolean;
  /** Render a TeamMark monogram before each team name (dashboard polish). */
  withTeamMarks?: boolean;
  /** Team brand colors by team id, for TeamMark (name-derived fallback). */
  teamColors?: Record<string, string | null>;
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
  playoffCut,
  showPlayoffCutDivider = false,
  withTeamMarks = false,
  teamColors,
}: StandingsTableProps) {
  const cut = playoffCut && playoffCut > 0 ? playoffCut : 0;
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
            const clinched =
              cut > 0 &&
              row.leagueRank <= cut &&
              row.wins + row.losses + row.ties > 0;
            const teamLink = (
              <Link
                href={`/dashboard/teams/${row.teamId}`}
                className="text-primary hover:underline"
              >
                {row.teamName}
              </Link>
            );
            return (
              <Fragment key={row.teamId}>
              <tr className="border-b border-border">
                <td className="px-4 py-2 font-mono tabular-nums text-foreground">
                  {row.leagueRank}
                </td>
                <td className="px-4 py-2 text-foreground">
                  {withTeamMarks || clinched ? (
                    <span className="flex items-center gap-2.5">
                      {withTeamMarks ? (
                        <TeamMark
                          name={row.teamName}
                          primaryColor={teamColors?.[row.teamId]}
                          size="sm"
                        />
                      ) : null}
                      {teamLink}
                      {clinched ? (
                        <Badge variant="success">Clinched</Badge>
                      ) : null}
                    </span>
                  ) : (
                    teamLink
                  )}
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
              {showPlayoffCutDivider && cut > 0 && row.leagueRank === cut ? (
                <tr aria-hidden="true" data-testid="playoff-cut-divider">
                  <td colSpan={9} className="p-0">
                    <div className="relative border-t-2 border-dashed border-border-strong">
                      <span className="absolute -top-2 right-3 bg-card px-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        Playoff cut
                      </span>
                    </div>
                  </td>
                </tr>
              ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

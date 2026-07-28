"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  scoutProspectAction,
  signProspectAction,
} from "@/app/dashboard/_actions/recruiting";
import type { ProspectDto } from "@/lib/data-api";
import {
  MAX_SCOUT_LEVEL,
  OVERALL_MAX,
  OVERALL_MIN,
  nextScoutCost,
} from "@/lib/dynasty/scouting";

/*
 * The recruiting board (Dynasty Mode B3).
 *
 * The one rule this component exists to enforce: a prospect is shown as a
 * RANGE, never as a number. There is no exact-overall rendering path here even
 * for a fully scouted prospect, because the moment one exists the mechanic
 * becomes a spreadsheet — you would scout to level 3 and read the answer.
 *
 * The bar is the whole design. Its width is the uncertainty, so spending points
 * is legible as the bar getting shorter rather than as a number changing, and
 * two prospects with overlapping bars are visibly a judgment call.
 */

const REASON_COPY: Record<string, string> = {
  scouting_budget_exhausted:
    "The league is out of scouting points for this offseason.",
  prospect_fully_scouted: "This prospect is already fully scouted.",
  prospect_already_signed: "Another program signed this prospect first.",
  recruiting_class_full: "This team's recruiting class is already full.",
  season_locked: "The roster is locked for this season.",
  not_authorized: "You cannot recruit for this team.",
};

function copyFor(reason: string): string {
  return REASON_COPY[reason] ?? "Could not complete that recruiting action.";
}

export interface ScoutingPanelProps {
  seasonId: string;
  prospects: ProspectDto[];
  teams: { id: string; name: string }[];
  /** The team a coach acts for, or null when they manage none. */
  actingTeam: { id: string; name: string } | null;
  canRecruit: boolean;
  scoutingPointsSpent: number;
  scoutingPointsTotal: number;
}

export function ScoutingPanel({
  seasonId,
  prospects,
  teams,
  actingTeam,
  canRecruit,
  scoutingPointsSpent,
  scoutingPointsTotal,
}: ScoutingPanelProps) {
  const [spent, setSpent] = useState(scoutingPointsSpent);
  const [rows, setRows] = useState(prospects);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const teamNames = useMemo(
    () => new Map(teams.map((team) => [team.id, team.name])),
    [teams],
  );

  /*
   * Sorted by the TOP of the range, so an unscouted prospect with a wide band
   * can outrank a scouted one. That is deliberate: the board should reward
   * looking again, not present a settled order that scouting merely confirms.
   */
  const board = useMemo(
    () =>
      [...rows].sort(
        (a, b) => b.projectedHigh - a.projectedHigh || a.name.localeCompare(b.name),
      ),
    [rows],
  );

  const remaining = Math.max(0, scoutingPointsTotal - spent);

  function replace(next: ProspectDto) {
    setRows((current) =>
      current.map((row) => (row.id === next.id ? next : row)),
    );
  }

  function scout(prospect: ProspectDto) {
    if (!actingTeam) return;
    setMessage(null);
    startTransition(async () => {
      const result = await scoutProspectAction({
        prospectId: prospect.id,
        teamId: actingTeam.id,
        seasonId,
      });
      if (!result.ok) {
        setMessage(copyFor(result.error));
        return;
      }
      replace(result.data.prospect);
      setSpent(result.data.scoutingPointsSpent);
    });
  }

  function sign(prospect: ProspectDto) {
    if (!actingTeam) return;
    setMessage(null);
    startTransition(async () => {
      const result = await signProspectAction({
        prospectId: prospect.id,
        teamId: actingTeam.id,
        seasonId,
      });
      if (!result.ok) {
        setMessage(copyFor(result.error));
        return;
      }
      replace(result.data.prospect);
      setMessage(`Signed ${prospect.name}.`);
    });
  }

  if (board.length === 0) {
    return (
      <section data-testid="scouting-panel" className="space-y-2">
        <h3 className="text-sm font-semibold">Recruiting class</h3>
        <p className="text-sm text-muted-foreground">
          No recruiting class was generated for this season.
        </p>
      </section>
    );
  }

  return (
    <section data-testid="scouting-panel" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Recruiting class</h3>
        <p
          className="text-sm text-muted-foreground"
          data-testid="scouting-points-remaining"
        >
          {remaining} of {scoutingPointsTotal} scouting points remaining
        </p>
      </div>

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}

      <ul className="divide-y rounded-md border">
        {board.map((prospect) => {
          const cost = nextScoutCost(prospect.scoutLevel);
          const signedBy = prospect.signedTeamId
            ? (teamNames.get(prospect.signedTeamId) ?? "another program")
            : null;
          return (
            <li
              key={prospect.id}
              className="flex flex-wrap items-center gap-3 p-3"
              data-testid="prospect-row"
            >
              <div className="min-w-[11rem] flex-1">
                <p className="text-sm font-medium">{prospect.name}</p>
                <p className="text-xs text-muted-foreground">
                  {prospect.position} · {prospect.archetype}
                  {prospect.hometown ? ` · ${prospect.hometown}` : ""}
                </p>
              </div>

              <ProspectRange
                low={prospect.projectedLow}
                high={prospect.projectedHigh}
                scoutLevel={prospect.scoutLevel}
              />

              {signedBy ? (
                <span className="text-xs text-muted-foreground">
                  Signed · {signedBy}
                </span>
              ) : (
                canRecruit &&
                actingTeam && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || cost === null || cost > remaining}
                      onClick={() => scout(prospect)}
                    >
                      {cost === null ? "Fully scouted" : `Scout (${cost})`}
                    </Button>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => sign(prospect)}
                    >
                      Sign
                    </Button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A prospect's projected overall, as a bar.
 *
 * Renders `low–high` and never a midpoint or a single figure: a midpoint would
 * be read as the answer, and the whole point is that there is not one yet.
 */
function ProspectRange({
  low,
  high,
  scoutLevel,
}: {
  low: number;
  high: number;
  scoutLevel: number;
}) {
  const span = OVERALL_MAX - OVERALL_MIN;
  const left = ((low - OVERALL_MIN) / span) * 100;
  const width = Math.max(1, ((high - low) / span) * 100);
  return (
    <div className="w-44" data-testid="prospect-range">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-mono">
          {low}–{high}
        </span>
        <span className="text-muted-foreground">
          Scout {scoutLevel}/{MAX_SCOUT_LEVEL}
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-muted"
        role="img"
        aria-label={`Projected overall between ${low} and ${high}`}
      >
        <div
          className="h-2 rounded-full bg-primary"
          style={{ marginLeft: `${left}%`, width: `${width}%` }}
        />
      </div>
    </div>
  );
}

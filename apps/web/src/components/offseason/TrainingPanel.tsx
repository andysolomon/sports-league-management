"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { allocateTrainingAction } from "@/app/dashboard/_actions/training";
import type {
  RosterBoardPlayerDto,
  TrainingAllocationDto,
} from "@/lib/data-api";
import {
  TRAINING_FOCUSES,
  TRAINING_POINT_OPTIONS,
  applyTraining,
  focusAttributeKeys,
  totalAllocatedPoints,
  trainingGate,
  type TrainingFocus,
} from "@/lib/dynasty/training";
import { attributeGroupForPosition } from "@/lib/synthetic-attributes";

/*
 * The spring training board (Dynasty Mode B6).
 *
 * The one thing this panel exists to make visible: what a point BUYS. A budget
 * meter on its own is a chore — you spend down to zero because the number is
 * there. So every option is priced in the ratings it would move, computed with
 * the same `applyTraining` the mutation runs, and the coach can see that ten
 * points on one player is worth less than the same ten spread across three.
 *
 * The panel and the mutation share `trainingGate`, so a control that is offered
 * is a control that works — the same arrangement as B5's squad button.
 */

const REASON_COPY: Record<string, string> = {
  training_budget_exhausted:
    "This team has no training points left for the offseason.",
  invalid_focus: "That is not a training focus.",
  invalid_points: "That is not a valid number of points.",
  player_not_on_team: "That player is no longer on this roster.",
  season_locked: "The roster is locked for this season.",
  not_authorized: "You cannot train for this team.",
};

function copyFor(reason: string): string {
  return REASON_COPY[reason] ?? "Could not record that training.";
}

function parseAttributes(json: string | null): Record<string, number> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export interface TrainingPanelProps {
  seasonId: string;
  players: RosterBoardPlayerDto[];
  allocations: TrainingAllocationDto[];
  /** The team this viewer trains for, or null when they manage none. */
  actingTeam: { id: string; name: string } | null;
  /** This team's allowance for the offseason. */
  pointsTotal: number;
}

export function TrainingPanel({
  seasonId,
  players,
  allocations,
  actingTeam,
  pointsTotal,
}: TrainingPanelProps) {
  const [rows, setRows] = useState(allocations);
  const [focus, setFocus] = useState<TrainingFocus>("athleticism");
  const [points, setPoints] = useState(TRAINING_POINT_OPTIONS[0] ?? 2);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const spent = useMemo(() => totalAllocatedPoints(rows), [rows]);
  const remaining = Math.max(0, pointsTotal - spent);

  /*
   * Committed points per player, so a coach can see where his spring has
   * already gone without reading the ledger as a list of transactions.
   */
  const committed = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.playerId, (map.get(row.playerId) ?? 0) + row.points);
    }
    return map;
  }, [rows]);

  const board = useMemo(
    () =>
      [...players].sort(
        (a, b) => (b.overall ?? 0) - (a.overall ?? 0) || a.name.localeCompare(b.name),
      ),
    [players],
  );

  const gate = trainingGate({ focus, points, spent, total: pointsTotal });

  function allocate(player: RosterBoardPlayerDto) {
    if (!actingTeam) return;
    setMessage(null);
    startTransition(async () => {
      const result = await allocateTrainingAction({
        playerId: player.playerId,
        teamId: actingTeam.id,
        seasonId,
        focus,
        points,
      });
      if (!result.ok) {
        setMessage(copyFor(result.error));
        return;
      }
      setRows((current) => [...current, result.data.allocation]);
      setMessage(`Committed ${points} points to ${player.name}.`);
    });
  }

  if (board.length === 0) {
    return (
      <section data-testid="training-panel" className="space-y-2">
        <h3 className="text-sm font-semibold">Training</h3>
        <p className="text-sm text-muted-foreground">
          {actingTeam
            ? `${actingTeam.name} has nobody on its roster to train.`
            : "You do not manage a team in this league."}
        </p>
      </section>
    );
  }

  return (
    <section data-testid="training-panel" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Training</h3>
        <p
          className="text-sm text-muted-foreground"
          data-testid="training-points-remaining"
        >
          {remaining} of {pointsTotal} training points remaining
        </p>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${spent} of ${pointsTotal} training points committed`}
        data-testid="training-budget-meter"
      >
        <div
          className="h-2 rounded-full bg-primary"
          style={{
            width: `${pointsTotal > 0 ? Math.min(100, (spent / pointsTotal) * 100) : 0}%`,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground">
          Focus
          <select
            className="ml-2 rounded-md border bg-background px-2 py-1 text-sm"
            data-testid="training-focus"
            value={focus}
            onChange={(event) => setFocus(event.target.value as TrainingFocus)}
          >
            {TRAINING_FOCUSES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted-foreground">
          Points
          <select
            className="ml-2 rounded-md border bg-background px-2 py-1 text-sm"
            data-testid="training-points"
            value={points}
            onChange={(event) => setPoints(Number(event.target.value))}
          >
            {TRAINING_POINT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-muted-foreground">
          {TRAINING_FOCUSES.find((option) => option.id === focus)?.blurb}
        </p>
      </div>

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}

      <ul className="divide-y rounded-md border">
        {board.map((player) => {
          const attributes = parseAttributes(player.attributesJson);
          const positionGroup =
            player.positionGroup ?? attributeGroupForPosition(player.position);
          /*
           * The preview is the mutation's own arithmetic, not an estimate of
           * it. `applyTraining` respects the 99 ceiling, so a maxed-out player
           * honestly shows +0 rather than a gain he cannot receive.
           */
          const preview = applyTraining({
            attributes,
            positionGroup,
            allocations: [{ focus, points }],
          });
          /*
           * "Nothing to train" and "nowhere left to put it" are different
           * facts and a coach needs to tell them apart: one is a player
           * without ratings, the other is a player already at 99. Collapsing
           * them into one message would read as the panel being broken.
           */
          const trainable = focusAttributeKeys(focus, positionGroup).some(
            (key) => key in attributes,
          );
          const already = committed.get(player.playerId) ?? 0;

          return (
            <li
              key={player.playerId}
              className="flex flex-wrap items-center gap-3 p-3"
              data-testid="training-row"
            >
              <div className="min-w-[11rem] flex-1">
                <p className="text-sm font-medium">{player.name}</p>
                <p className="text-xs text-muted-foreground">
                  {player.position}
                  {player.grade !== null ? ` · Grade ${player.grade}` : ""}
                  {player.overall !== null ? ` · ${player.overall} OVR` : ""}
                  {already > 0 ? ` · ${already} pts committed` : ""}
                </p>
              </div>

              <p
                className="min-w-[9rem] font-mono text-xs text-muted-foreground"
                data-testid="training-preview"
              >
                {preview.pointsPlaced > 0
                  ? Object.entries(preview.gains)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, gain]) => `${key} +${gain}`)
                      .join(" · ")
                  : trainable
                    ? "no headroom"
                    : "not trainable"}
              </p>

              {actingTeam && (
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="training-commit"
                  disabled={pending || gate.ok !== true}
                  onClick={() => allocate(player)}
                >
                  Train ({points})
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ReleasePlayerButton } from "@/components/offseason/ReleasePlayerButton";
import {
  changePlayerPositionAction,
  setPlayerSquadAction,
} from "@/app/dashboard/_actions/roster-moves";
import type { RosterBoardPlayerDto } from "@/lib/data-api";
import {
  JV,
  POSITION_CHANGE_OPTIONS,
  VARSITY,
  positionChangeFit,
  recommendPromotions,
  squadChange,
} from "@/lib/dynasty/promotions";

/*
 * Roster shaping (Dynasty Mode B5).
 *
 * Three decisions, in the order a coach actually makes them: who comes up,
 * who moves, who goes. The recommendations sit at the top because they are the
 * only part of this panel that has an OPINION — the rest is a list of players
 * and controls, and a coach who opened it cold would otherwise have to compare
 * forty ratings by eye to find the one decision worth making.
 *
 * The eligibility rules are asked of the same pure function the mutation
 * enforces (`squadChange`), so a button that is offered is a button that works.
 * Rendering a control and letting the server reject it is how a panel starts
 * lying about the rules.
 */

const REASON_COPY: Record<string, string> = {
  grade_too_low_for_varsity:
    "Freshmen play JV. He is eligible once he reaches tenth grade.",
  grade_requires_varsity:
    "Juniors and seniors are Varsity — he cannot be sent down.",
  grade_unknown: "He has no grade on file, so eligibility cannot be checked.",
  invalid_position: "That is not a position this league recognises.",
  invalid_squad: "That is not a squad.",
  season_locked: "The roster is locked for this season.",
  player_not_on_team: "He is no longer on this roster.",
  not_authorized: "You cannot make roster moves for this team.",
};

function copyFor(reason: string): string {
  return REASON_COPY[reason] ?? "Could not complete that roster move.";
}

function parseAttributes(json: string | null): Record<string, number> {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export interface PromotionsPanelProps {
  seasonId: string;
  players: RosterBoardPlayerDto[];
  /** The team this viewer shapes, or null when they manage none. */
  actingTeam: { id: string; name: string } | null;
}

export function PromotionsPanel({
  seasonId,
  players,
  actingTeam,
}: PromotionsPanelProps) {
  const [rows, setRows] = useState(players);
  const [message, setMessage] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const recommendations = useMemo(
    () =>
      recommendPromotions(
        rows.map((row) => ({
          playerId: row.playerId,
          name: row.name,
          position: row.position,
          grade: row.grade,
          squad: row.squad,
          overall: row.overall,
        })),
      ),
    [rows],
  );

  function move(player: RosterBoardPlayerDto, squad: string) {
    if (!actingTeam) return;
    setMessage(null);
    startTransition(async () => {
      const result = await setPlayerSquadAction({
        playerId: player.playerId,
        teamId: actingTeam.id,
        seasonId,
        squad,
      });
      if (!result.ok) {
        setMessage(copyFor(result.error));
        return;
      }
      setRows((current) =>
        current.map((row) =>
          row.playerId === player.playerId
            ? { ...row, squad: result.data.squad }
            : row,
        ),
      );
      setMessage(
        squad === VARSITY
          ? `${player.name} moves up to Varsity.`
          : `${player.name} drops to JV.`,
      );
    });
  }

  function changePosition(player: RosterBoardPlayerDto, position: string) {
    if (!actingTeam) return;
    setMessage(null);
    setOpenFor(null);
    startTransition(async () => {
      const result = await changePlayerPositionAction({
        playerId: player.playerId,
        teamId: actingTeam.id,
        seasonId,
        position,
      });
      if (!result.ok) {
        setMessage(copyFor(result.error));
        return;
      }
      setRows((current) =>
        current.map((row) =>
          row.playerId === player.playerId
            ? {
                ...row,
                position: result.data.position,
                positionGroup: result.data.positionGroup,
              }
            : row,
        ),
      );
      setMessage(`${player.name} moves to ${result.data.position}.`);
    });
  }

  if (!actingTeam) {
    return (
      <section data-testid="promotions-panel" className="space-y-3">
        <h3 className="text-sm font-semibold">Roster moves</h3>
        <p className="text-sm text-muted-foreground">
          You do not manage a team in this league, so there is nothing here to
          decide.
        </p>
      </section>
    );
  }

  return (
    <section data-testid="promotions-panel" className="space-y-4">
      <h3 className="text-sm font-semibold">Roster moves</h3>

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}

      <div className="space-y-2" data-testid="promotion-recommendations">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
          Ready to move up
        </h4>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody on JV is outplaying your Varsity roster.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {recommendations.map((rec) => {
              const player = rows.find((row) => row.playerId === rec.playerId);
              return (
                <li
                  key={rec.playerId}
                  className="flex flex-wrap items-center gap-3 p-3"
                  data-testid="promotion-recommendation"
                >
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-sm font-medium">{rec.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {rec.position} · {rec.overall} OVR ·{" "}
                      {rec.replacesName
                        ? `${rec.margin} better than ${rec.replacesName}`
                        : "nobody plays there"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={pending || !player}
                    onClick={() => player && move(player, VARSITY)}
                  >
                    Move up
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2" data-testid="roster-board">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
          Roster
        </h4>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This roster is empty for the upcoming season.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => {
              const target = row.squad === VARSITY ? JV : VARSITY;
              const decision = squadChange({
                grade: row.grade,
                from: row.squad,
                to: target,
              });
              const attributes = parseAttributes(row.attributesJson);
              return (
                <li
                  key={row.playerId}
                  className="space-y-2 p-3"
                  data-testid="roster-move-row"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.position}
                        {row.grade === null ? "" : ` · Grade ${row.grade}`}
                        {row.overall === null ? "" : ` · ${row.overall} OVR`}
                        <span data-testid="roster-move-squad">
                          {" "}
                          · {row.squad ?? "Unassigned"}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        // Offered only when the rule allows it. A disabled
                        // control with a tooltip would still imply the move is
                        // a coaching call; for an upperclassman it is not.
                        disabled={pending || decision.ok !== true}
                        onClick={() => move(row, target)}
                      >
                        {target === VARSITY ? "Move up" : "Send to JV"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          setOpenFor(
                            openFor === row.playerId ? null : row.playerId,
                          )
                        }
                      >
                        Change position
                      </Button>
                      <ReleasePlayerButton
                        playerId={row.playerId}
                        playerName={row.name}
                      />
                    </div>
                  </div>

                  {openFor === row.playerId && (
                    <div
                      className="flex flex-wrap gap-2 rounded-md bg-muted/40 p-2"
                      data-testid="position-change-options"
                    >
                      {POSITION_CHANGE_OPTIONS.filter(
                        (position) => position !== row.position,
                      ).map((position) => {
                        /*
                         * Fit is shown next to every option because the whole
                         * question a coach is asking is "can he play there".
                         * A bare list of positions would make the control a
                         * guess.
                         */
                        const fit = Math.round(
                          positionChangeFit({
                            toPosition: position,
                            attributes,
                          }) * 100,
                        );
                        return (
                          <Button
                            key={position}
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => changePosition(row, position)}
                          >
                            {position}
                            <span className="ml-1 text-xs text-muted-foreground">
                              {fit}% fit
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

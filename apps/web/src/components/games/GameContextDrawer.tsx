"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, MapPin, Calendar } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatFixtureWhen } from "@/lib/format";
import {
  type GameDrawerProjection,
  gameDrawerCanOpenGamecast,
  gameDrawerIsFinal,
  gameDrawerMatchupLabel,
} from "@/lib/game-drawer-projection";
import { cn } from "@/lib/utils";

export interface GameContextDrawerProps {
  projection: GameDrawerProjection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to restore focus to when the drawer closes. */
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}

function TeamBlock({
  team,
  score,
  scoreTestId,
  won,
  dim,
  align,
}: {
  team: GameDrawerProjection["home"];
  score: number | null;
  scoreTestId?: string;
  won: boolean;
  dim: boolean;
  align: "left" | "right";
}) {
  const meta = [
    team.seed != null ? `#${team.seed} seed` : null,
    team.record,
  ]
    .filter(Boolean)
    .join(" · ");

  const nameClass = cn(
    "text-base font-semibold text-foreground",
    won && "text-foreground",
    dim && !won && "text-muted-foreground",
  );

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1",
        align === "right" && "items-end text-right",
      )}
    >
      {team.id ? (
        <Link href={`/dashboard/teams/${team.id}`} className={cn(nameClass, "hover:underline")}>
          {team.name}
        </Link>
      ) : (
        <span className={nameClass}>{team.name}</span>
      )}
      {meta ? (
        <span className="text-xs text-muted-foreground">{meta}</span>
      ) : null}
      {score != null ? (
        <span
          className="font-mono text-2xl tabular-nums text-foreground"
          data-testid={scoreTestId}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}

export function GameContextDrawer({
  projection,
  open,
  onOpenChange,
  restoreFocusRef,
}: GameContextDrawerProps) {
  const titleId = React.useId();
  const isFinal = projection ? gameDrawerIsFinal(projection) : false;
  const canOpenGamecast = projection
    ? gameDrawerCanOpenGamecast(projection)
    : false;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next && restoreFocusRef?.current) {
      requestAnimationFrame(() => {
        restoreFocusRef.current?.focus();
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        aria-labelledby={titleId}
        data-testid="game-context-drawer"
        className="flex w-[min(100vw,24rem)] max-w-[100vw] flex-col overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        {projection ? (
          <>
            <div className="space-y-1 pr-8">
              <p
                data-testid="game-drawer-mode"
                className="font-mono text-caption-12 uppercase tracking-wide text-muted-foreground"
              >
                {isFinal ? "Final" : "Preview"}
                {projection.roundLabel ? ` · ${projection.roundLabel}` : ""}
              </p>
              <h2 id={titleId} className="text-lg font-semibold text-foreground">
                {gameDrawerMatchupLabel(projection)}
              </h2>
              {projection.status ? (
                <StatusBadge status={projection.status} />
              ) : null}
            </div>

            <div className="flex items-start justify-between gap-4 border-y border-border py-4">
              <TeamBlock
                team={projection.home}
                score={isFinal ? projection.homeScore : null}
                scoreTestId="game-drawer-home-score"
                won={
                  isFinal &&
                  projection.homeScore != null &&
                  projection.awayScore != null &&
                  projection.homeScore > projection.awayScore
                }
                dim={isFinal}
                align="left"
              />
              <span className="shrink-0 pt-6 font-mono text-sm text-muted-foreground">
                {isFinal ? "–" : "vs"}
              </span>
              <TeamBlock
                team={projection.away}
                score={isFinal ? projection.awayScore : null}
                scoreTestId="game-drawer-away-score"
                won={
                  isFinal &&
                  projection.homeScore != null &&
                  projection.awayScore != null &&
                  projection.awayScore > projection.homeScore
                }
                dim={isFinal}
                align="right"
              />
            </div>

            <dl className="space-y-3 text-sm">
              {projection.scheduledAt ? (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <dt className="sr-only">Scheduled</dt>
                    <dd>{formatFixtureWhen(projection.scheduledAt)}</dd>
                  </div>
                </div>
              ) : null}
              {projection.venue ? (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <dt className="sr-only">Venue</dt>
                    <dd>{projection.venue}</dd>
                  </div>
                </div>
              ) : null}
            </dl>

            {isFinal && !canOpenGamecast ? (
              <p className="text-sm text-muted-foreground">
                Final score recorded. Full Gamecast is available for simulated
                games with a stored play-by-play log.
              </p>
            ) : null}

            {!isFinal ? (
              <p className="text-sm text-muted-foreground">
                Kickoff preview — open the full Gamecast after the game is
                played and a play log exists.
              </p>
            ) : null}

            <div className="mt-auto flex flex-col gap-2 pt-4">
              {canOpenGamecast && projection.fixtureId ? (
                <Button asChild className="w-full">
                  <Link
                    href={`/dashboard/games/${projection.fixtureId}/gamecast`}
                    data-testid="game-drawer-open-gamecast"
                  >
                    Open full Gamecast
                    <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
              <SheetClose asChild>
                <Button type="button" variant="outline" className="w-full">
                  Close
                </Button>
              </SheetClose>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

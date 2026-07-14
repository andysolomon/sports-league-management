"use client";

import * as React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamMark } from "@/components/team-mark";
import type { PlayoffMatchupDto } from "@/lib/data-api";
import { bracketSections, winnerSide } from "@/lib/playoffs";
import type { PlayoffBracketDto } from "@/lib/data-api";
import {
  projectionFromMatchup,
  gameDrawerMatchupLabel,
} from "@/lib/game-drawer-projection";
import { GameContextDrawer } from "@/components/games/GameContextDrawer";

function TeamName({
  teamId,
  name,
  won,
  dim,
  linkable,
}: {
  teamId: string | null;
  name: string | null;
  won: boolean;
  dim: boolean;
  linkable: boolean;
}) {
  const label = name ?? "TBD";
  const className = cn(
    "truncate",
    linkable && "hover:underline",
    won && "font-semibold text-foreground",
    dim && !won && "text-muted-foreground",
  );
  if (teamId && linkable) {
    return (
      <Link href={`/dashboard/teams/${teamId}`} className={className}>
        {label}
      </Link>
    );
  }
  return <span className={className}>{label}</span>;
}

function Side({
  teamId,
  seed,
  name,
  score,
  won,
  dim,
  linkable,
  teamColors,
}: {
  teamId: string | null;
  seed: number | null;
  name: string | null;
  score: number | null;
  won: boolean;
  dim: boolean;
  linkable: boolean;
  teamColors?: Record<string, string | null>;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 text-sm",
        won && "bg-muted",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {/* Prototype seed slot: fixed-width plain mono digit, kept even when
            empty so team names align across TBD and seeded cards. */}
        <span className="w-4 shrink-0 text-center font-mono text-caption-12 tabular-nums text-muted-foreground">
          {seed ?? ""}
        </span>
        {name ? (
          <TeamMark
            name={name}
            primaryColor={teamId ? teamColors?.[teamId] : null}
            size="sm"
            className="h-5 w-5 text-[9px]"
          />
        ) : null}
        <TeamName
          teamId={teamId}
          name={name}
          won={won}
          dim={dim}
          linkable={linkable}
        />
      </span>
      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
        {score ?? ""}
      </span>
    </div>
  );
}

function MatchupCard({
  m,
  roundLabel,
  teamColors,
}: {
  m: PlayoffMatchupDto;
  roundLabel: string;
  teamColors?: Record<string, string | null>;
}) {
  const side = winnerSide(m);
  const decided = side !== null;
  const projection = projectionFromMatchup(m, roundLabel);
  const [open, setOpen] = React.useState(false);
  const restoreFocusRef = React.useRef<HTMLButtonElement | null>(null);

  const card = m.isBye ? (
    <div className="overflow-hidden rounded-lg border border-dashed border-border bg-card">
      <Side
        teamId={m.homeTeamId}
        seed={m.homeSeed}
        name={m.homeTeamName}
        score={null}
        won={true}
        dim={false}
        linkable={false}
        teamColors={teamColors}
      />
      <div className="border-t border-border" />
      <div className="px-3 py-1.5 text-xs italic text-muted-foreground">
        Bye — advances
      </div>
    </div>
  ) : (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Side
        teamId={m.homeTeamId}
        seed={m.homeSeed}
        name={m.homeTeamName}
        score={m.homeScore}
        won={side === "home"}
        dim={decided}
        linkable={false}
        teamColors={teamColors}
      />
      <div className="border-t border-border" />
      <Side
        teamId={m.awayTeamId}
        seed={m.awaySeed}
        name={m.awayTeamName}
        score={m.awayScore}
        won={side === "away"}
        dim={decided}
        linkable={false}
        teamColors={teamColors}
      />
    </div>
  );

  if (!projection) {
    return card;
  }

  const drawerLabel = `View ${projection.status === "final" ? "final" : "preview"} for ${gameDrawerMatchupLabel(projection)}`;

  return (
    <>
      <button
        ref={restoreFocusRef}
        type="button"
        aria-label={drawerLabel}
        aria-haspopup="dialog"
        data-testid={`playoff-drawer-trigger-${m.id}`}
        onClick={() => setOpen(true)}
        className="block w-full rounded-lg text-left transition-colors hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {card}
      </button>
      <GameContextDrawer
        projection={projection}
        open={open}
        onOpenChange={setOpen}
        restoreFocusRef={restoreFocusRef}
      />
    </>
  );
}

/**
 * Read-only playoff bracket (WSM-000165, WSM-flex-brackets). Single-elim renders
 * one column per round; double-elim renders three stacked regions (winners
 * bracket, losers bracket, grand final), each as columns. Columns scroll
 * horizontally on small screens. Winners are bolded, losers dimmed, unresolved
 * slots show "TBD", and first-round byes are marked.
 */
export default function PlayoffBracket({
  bracket,
  teamColors,
}: {
  bracket: PlayoffBracketDto;
  /** Team brand colors by team id, for TeamMark (name-derived fallback). */
  teamColors?: Record<string, string | null>;
}) {
  const sections = bracketSections(
    bracket.matchups,
    bracket.rounds,
    bracket.format,
  );

  return (
    <div className="flex flex-col gap-6">
      {bracket.champion ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-primary/30 bg-primary/10 px-5 py-4">
          <Trophy className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-mono text-caption-12 uppercase tracking-wide text-primary">
              Champion
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              {bracket.champion.teamId ? (
                <Link
                  href={`/dashboard/teams/${bracket.champion.teamId}`}
                  className="hover:underline"
                >
                  {bracket.champion.teamName ?? "Champion"}
                </Link>
              ) : (
                (bracket.champion.teamName ?? "Champion")
              )}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.type}>
            {section.title ? (
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {section.title}
              </h3>
            ) : null}
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-8 pb-2">
                {section.rounds.map((r) => {
                  // Prototype phase treatment: rounds that have not been
                  // built yet still render their column with dimmed TBD
                  // placeholder cards (winners-bracket geometry only).
                  const placeholderCount =
                    section.type === "winners" && r.matchups.length === 0
                      ? Math.max(1, 2 ** (bracket.rounds - r.round))
                      : 0;
                  return (
                    <div
                      key={`${section.type}-${r.round}`}
                      className="flex w-56 shrink-0 flex-col"
                    >
                      <h4 className="mb-3 font-mono text-caption-12 uppercase tracking-wide text-muted-foreground">
                        {r.label}
                      </h4>
                      <div className="flex flex-1 flex-col justify-around gap-5">
                        {r.matchups.length > 0
                          ? r.matchups.map((m) => (
                              <MatchupCard
                                key={m.id}
                                m={m}
                                roundLabel={r.label}
                                teamColors={teamColors}
                              />
                            ))
                          : Array.from({ length: placeholderCount }).map(
                              (_, slot) => (
                                <PlaceholderMatchup key={slot} />
                              ),
                            )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Dimmed two-side TBD card for rounds the bracket has not reached yet. */
function PlaceholderMatchup() {
  return (
    <div className="overflow-hidden rounded-lg border border-dashed border-border bg-card opacity-60">
      <PlaceholderSide />
      <div className="border-t border-border" />
      <PlaceholderSide />
    </div>
  );
}

function PlaceholderSide() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm">
      <span className="w-4 shrink-0" />
      <span className="text-muted-foreground">TBD</span>
    </div>
  );
}

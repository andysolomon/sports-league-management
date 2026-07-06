"use client";

import { useEffect, useRef } from "react";
import type { DrivePlayGroup, TeamDisplay } from "@/lib/gamecast";
import {
  describePlay,
  driveResultLabel,
  formatDownAndDistance,
  formatGameClock,
  formatQuarterLabel,
} from "@/lib/gamecast";
import type { PbpPlay } from "@/lib/pbp";
import { cn } from "@/lib/utils";

export interface PlayListProps {
  groups: DrivePlayGroup[];
  allPlaysFlat: PbpPlay[];
  homeTeamId: string;
  homeTeam: TeamDisplay & { name: string };
  awayTeam: TeamDisplay & { name: string };
  playIndex: number;
  mode: "sim" | "review";
  animate: boolean;
  onPlaySelect: (playIndex: number) => void;
}

function playFlatIndex(allPlaysFlat: PbpPlay[], playId: number): number {
  return allPlaysFlat.findIndex((p) => p.playId === playId);
}

export default function PlayList({
  groups,
  allPlaysFlat,
  homeTeamId,
  homeTeam,
  awayTeam,
  playIndex,
  mode,
  animate,
  onPlaySelect,
}: PlayListProps) {
  const currentRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({
      behavior: animate ? "smooth" : "auto",
      block: "nearest",
    });
  }, [playIndex, animate]);

  if (groups.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        Press Next play to start the gamecast.
      </p>
    );
  }

  const displayGroups = [...groups].reverse().map((group) => ({
    ...group,
    plays: [...group.plays].reverse(),
  }));

  return (
    <div className="max-h-[28rem] overflow-y-auto">
      {displayGroups.map((group) => {
        const team =
          group.teamId === homeTeamId ? homeTeam : awayTeam;
        return (
          <section key={group.driveId} className="border-b border-border">
            <header className="sticky top-0 z-10 border-b border-border bg-surface-2 px-3.5 py-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: team.color }}
                  aria-hidden
                />
                <span
                  className="font-mono font-bold"
                  style={{ color: team.color }}
                >
                  {team.abbr}
                </span>
                <span className="font-semibold text-text-muted">
                  {driveResultLabel(group.endReason)}
                </span>
              </div>
            </header>
            <ul>
              {group.plays.map((play) => {
                const flatIdx = playFlatIndex(allPlaysFlat, play.playId);
                const targetIndex = flatIdx + 1;
                const isCurrent = targetIndex === playIndex;
                const isFuture = flatIdx >= playIndex;
                const dimmed = mode === "review" && isFuture;

                return (
                  <li
                    key={play.playId}
                    ref={isCurrent ? currentRef : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => onPlaySelect(targetIndex)}
                      className={cn(
                        "w-full border-b border-border px-3.5 py-2.5 text-left",
                        animate && "transition-colors duration-200",
                        isCurrent && "border-l-2 bg-surface-2",
                        dimmed && "opacity-40",
                      )}
                      style={
                        isCurrent
                          ? { borderLeftColor: team.color }
                          : undefined
                      }
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-text-muted">
                          {formatDownAndDistance(play)}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-subtle">
                          {formatQuarterLabel(play.quarter)}{" "}
                          {formatGameClock(play.clockSeconds)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 text-body-15",
                          isCurrent ? "text-foreground" : "text-text-muted",
                        )}
                      >
                        {describePlay(play)}
                        {play.isScoring ? (
                          <span className="ml-2 font-mono font-medium text-accent">
                            +{play.pointsScored}
                          </span>
                        ) : null}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

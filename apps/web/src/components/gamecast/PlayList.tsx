import { useEffect, useRef } from "react";
import type { DrivePlayGroup } from "@/lib/gamecast";
import { describePlay, driveResultLabel, formatDownAndDistance } from "@/lib/gamecast";

interface PlayListProps {
  groups: DrivePlayGroup[];
  homeTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  animate: boolean;
}

export default function PlayList({
  groups,
  homeTeamId,
  homeTeamName,
  awayTeamName,
  animate,
}: PlayListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: animate ? "smooth" : "auto",
      block: "nearest",
    });
  }, [groups, animate]);

  if (groups.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        Press Next play to start the gamecast.
      </p>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {groups.map((group) => {
        const teamName =
          group.teamId === homeTeamId ? homeTeamName : awayTeamName;
        return (
          <section key={group.driveId} className="border-b border-border">
            <header className="sticky top-0 z-10 bg-surface-2 px-4 py-2">
              <div className="flex items-center justify-between gap-2 text-caption-12">
                <span className="font-medium text-foreground">
                  {teamName} drive
                </span>
                <span className="font-mono text-text-muted">
                  {driveResultLabel(group.endReason)}
                </span>
              </div>
            </header>
            <ul>
              {group.plays.map((play) => (
                <li
                  key={play.playId}
                  className={`border-t border-border px-4 py-2 ${
                    animate ? "transition-colors duration-200" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="shrink-0 font-mono text-caption-12 text-text-muted">
                      {formatDownAndDistance(play)}
                    </span>
                    <span className="shrink-0 font-mono text-caption-12 tabular-nums text-text-subtle">
                      {play.yardsGained > 0 ? `+${play.yardsGained}` : play.yardsGained}
                    </span>
                  </div>
                  <p className="mt-0.5 text-body-15 text-foreground">
                    {describePlay(play)}
                    {play.isScoring ? (
                      <span className="ml-2 font-medium text-accent">
                        +{play.pointsScored}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

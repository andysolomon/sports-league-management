import type { DriveChartSegment, TeamDisplay } from "@/lib/gamecast";
import {
  DRIVE_RESULT_TOKEN_COLORS,
  driveResultLabel,
  driveResultVisualToken,
} from "@/lib/gamecast";
import type { PbpDrive, PbpGameLog, PbpPlay } from "@/lib/pbp";
import { cn } from "@/lib/utils";

export interface DriveChartProps {
  log: PbpGameLog;
  plays: PbpPlay[];
  segments: DriveChartSegment[];
  homeTeam: TeamDisplay & { name: string };
  awayTeam: TeamDisplay & { name: string };
  mode: "sim" | "review";
  playIndex: number;
  onDriveSelect: (playIndex: number) => void;
}

function driveStartPlayIndex(plays: PbpPlay[], driveId: number): number {
  return plays.findIndex((p) => p.driveId === driveId);
}

function driveNetYards(drive: PbpDrive): number {
  if (drive.plays.length === 0) return 0;
  const last = drive.plays[drive.plays.length - 1];
  const end = last.fieldPosition + last.yardsGained;
  return end - drive.startFieldPosition;
}

function driveStartQuarter(drive: PbpDrive): number {
  return drive.plays[0]?.quarter ?? 1;
}

export default function DriveChart({
  log,
  plays,
  segments,
  homeTeam,
  awayTeam,
  mode,
  playIndex,
  onDriveSelect,
}: DriveChartProps) {
  const segmentById = new Map(segments.map((s) => [s.driveId, s]));
  const drives = [...log.drives].reverse();

  const visibleDrives =
    mode === "sim"
      ? drives.filter((d) => {
          const seg = segmentById.get(d.driveId);
          return seg?.isRevealed;
        })
      : drives;

  if (visibleDrives.length === 0) {
    return (
      <div aria-label="Drive chart">
        <Header homeTeam={homeTeam} awayTeam={awayTeam} />
        <p className="py-8 text-center text-caption-12 text-text-subtle">
          Drives appear here as the game is played.
        </p>
      </div>
    );
  }

  return (
    <div aria-label="Drive chart">
      <Header homeTeam={homeTeam} awayTeam={awayTeam} />
      <div className="gc-list max-h-72 space-y-2 overflow-y-auto pr-1">
        {visibleDrives.map((drive) => {
          const seg = segmentById.get(drive.driveId);
          if (!seg) return null;
          const team =
            drive.teamId === log.homeTeamId
              ? homeTeam
              : awayTeam;
          const startIdx = driveStartPlayIndex(plays, drive.driveId);
          const net = driveNetYards(drive);
          const resultColor = seg.isCurrent
            ? DRIVE_RESULT_TOKEN_COLORS.accent
            : DRIVE_RESULT_TOKEN_COLORS[driveResultVisualToken(seg.endReason)];

          return (
            <button
              key={drive.driveId}
              type="button"
              onClick={() => {
                if (startIdx >= 0) onDriveSelect(startIdx);
              }}
              className={cn(
                "grid w-full grid-cols-[58px_1fr_132px] items-center gap-3 rounded-[6px] border-l-[3px] px-2.5 py-[7px] text-left transition-colors",
                seg.isCurrent
                  ? "bg-surface-2"
                  : "bg-transparent hover:bg-surface-2/60",
              )}
              style={{ borderLeftColor: team.color }}
            >
              <div>
                <div
                  className="font-mono text-[12px] font-bold"
                  style={{ color: team.color }}
                >
                  {team.abbr}
                </div>
                <div className="font-mono text-[10px] text-text-subtle">
                  Q{driveStartQuarter(drive)}
                </div>
              </div>

              <div className="relative h-5 rounded-[5px] border border-border bg-surface">
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/60" />
                <div
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-[4px]"
                  style={{
                    left: `${Math.min(seg.startChart, seg.endChart)}%`,
                    width: `${Math.max(Math.abs(seg.endChart - seg.startChart), 2)}%`,
                    backgroundColor: resultColor,
                  }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full ring-2 ring-surface"
                  style={{
                    left: `calc(${seg.endChart}% - 6px)`,
                    backgroundColor: resultColor,
                  }}
                  aria-hidden
                />
              </div>

              <div className="text-right">
                <div className="text-[12px] font-semibold text-foreground">
                  {seg.isCurrent ? "In progress" : driveResultLabel(seg.endReason)}
                </div>
                <div className="font-mono text-[10px] text-text-subtle">
                  {drive.plays.length} pl · {net >= 0 ? `+${net}` : net} yds
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Header({
  homeTeam,
  awayTeam,
}: {
  homeTeam: TeamDisplay & { name: string };
  awayTeam: TeamDisplay & { name: string };
}) {
  return (
    <div className="mb-2 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wide text-text-subtle">
      <span>
        {homeTeam.name} ◄
      </span>
      <span>50</span>
      <span>
        ► {awayTeam.name}
      </span>
    </div>
  );
}

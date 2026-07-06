import type {
  PbpDrive,
  PbpDriveEndReason,
  PbpGameLog,
  PbpPlay,
} from "@/lib/pbp";

export interface DriveChartSegment {
  driveId: number;
  teamId: string;
  startChart: number;
  endChart: number;
  endReason: PbpDriveEndReason;
  isCurrent: boolean;
  isRevealed: boolean;
}

export interface DrivePlayGroup {
  driveId: number;
  teamId: string;
  endReason: PbpDriveEndReason;
  plays: PbpPlay[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Map an offense-perspective yard line onto a home-left broadcast field (0–100). */
export function offenseToChartYard(
  yardLine: number,
  offenseTeamId: string,
  homeTeamId: string,
): number {
  if (offenseTeamId === homeTeamId) return clamp(yardLine, 0, 100);
  return clamp(100 - yardLine, 0, 100);
}

function playIndexOf(plays: PbpPlay[], playId: number): number {
  return plays.findIndex((p) => p.playId === playId);
}

function driveRevealedEndField(
  drive: PbpDrive,
  plays: PbpPlay[],
  playIndex: number,
): number {
  let end = drive.startFieldPosition;
  for (const play of drive.plays) {
    const idx = playIndexOf(plays, play.playId);
    if (idx < 0 || idx >= playIndex) break;
    end = clamp(play.fieldPosition + play.yardsGained, 0, 100);
  }
  return end;
}

function driveFullyRevealed(
  drive: PbpDrive,
  plays: PbpPlay[],
  playIndex: number,
): boolean {
  const last = drive.plays[drive.plays.length - 1];
  if (!last) return false;
  const idx = playIndexOf(plays, last.playId);
  return idx >= 0 && idx < playIndex;
}

export function currentDriveId(
  plays: PbpPlay[],
  playIndex: number,
  fallbackDriveId: number | null,
): number | null {
  if (playIndex <= 0) return fallbackDriveId;
  return plays[Math.min(playIndex, plays.length) - 1]?.driveId ?? fallbackDriveId;
}

export function buildDriveChartSegments(
  log: PbpGameLog,
  plays: PbpPlay[],
  playIndex: number,
): DriveChartSegment[] {
  const activeDriveId = currentDriveId(
    plays,
    playIndex,
    log.drives[0]?.driveId ?? null,
  );

  return log.drives.map((drive) => {
    const startChart = offenseToChartYard(
      drive.startFieldPosition,
      drive.teamId,
      log.homeTeamId,
    );
    const offenseEnd = driveRevealedEndField(drive, plays, playIndex);
    const endChart = offenseToChartYard(
      offenseEnd,
      drive.teamId,
      log.homeTeamId,
    );
    const isRevealed =
      playIndex > 0 &&
      (driveFullyRevealed(drive, plays, playIndex) ||
        drive.plays.some((p) => {
          const idx = playIndexOf(plays, p.playId);
          return idx >= 0 && idx < playIndex;
        }));

    return {
      driveId: drive.driveId,
      teamId: drive.teamId,
      startChart,
      endChart,
      endReason: drive.endReason,
      isCurrent: drive.driveId === activeDriveId,
      isRevealed,
    };
  });
}

export function groupPlaysByDrive(
  log: PbpGameLog,
  revealed: PbpPlay[],
): DrivePlayGroup[] {
  const byDrive = new Map<number, PbpPlay[]>();
  for (const play of revealed) {
    const arr = byDrive.get(play.driveId) ?? [];
    arr.push(play);
    byDrive.set(play.driveId, arr);
  }

  return log.drives
    .filter((d) => byDrive.has(d.driveId))
    .map((d) => ({
      driveId: d.driveId,
      teamId: d.teamId,
      endReason: d.endReason,
      plays: byDrive.get(d.driveId) ?? [],
    }));
}

export type DriveResultToken =
  | "accent"
  | "primary"
  | "muted"
  | "danger"
  | "subtle";

/** Semantic token names for redesigned drive chart styling. */
export type DriveResultVisualToken =
  | "accent"
  | "gold"
  | "danger"
  | "border-strong"
  | "text-subtle";

export const DRIVE_RESULT_TOKEN_COLORS: Record<DriveResultVisualToken, string> = {
  accent: "var(--accent)",
  gold: "#e0b64a",
  danger: "var(--danger)",
  "border-strong": "var(--border-strong)",
  "text-subtle": "var(--text-subtle)",
};

export function driveResultVisualToken(
  reason: PbpDriveEndReason,
): DriveResultVisualToken {
  switch (reason) {
    case "touchdown":
      return "accent";
    case "field_goal":
      return "gold";
    case "turnover":
    case "downs":
    case "missed_field_goal":
      return "danger";
    case "end_of_half":
    case "end_of_game":
      return "border-strong";
    case "punt":
    default:
      return "text-subtle";
  }
}

export function driveResultColor(reason: PbpDriveEndReason): string {
  return DRIVE_RESULT_TOKEN_COLORS[driveResultVisualToken(reason)];
}

export function driveResultToken(
  reason: PbpDriveEndReason,
): DriveResultToken {
  switch (driveResultVisualToken(reason)) {
    case "accent":
      return "accent";
    case "gold":
      return "primary";
    case "danger":
      return "danger";
    case "border-strong":
      return "subtle";
    case "text-subtle":
    default:
      return "muted";
  }
}

export function driveResultLabel(reason: PbpDriveEndReason): string {
  switch (reason) {
    case "touchdown":
      return "Touchdown";
    case "field_goal":
      return "Field goal";
    case "punt":
      return "Punt";
    case "turnover":
      return "Turnover";
    case "downs":
      return "Turnover on downs";
    case "end_of_half":
      return "End of half";
    case "end_of_game":
      return "End of game";
    case "missed_field_goal":
      return "Missed FG";
    default:
      return reason;
  }
}

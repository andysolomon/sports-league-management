import type { PbpGameLog } from "@/lib/pbp";

/** Parse persisted log JSON into a {@link PbpGameLog}, or null when invalid. */
export function parseGamePlayLog(logJson: string): PbpGameLog | null {
  try {
    const parsed = JSON.parse(logJson) as PbpGameLog;
    if (
      !parsed ||
      typeof parsed.homeTeamId !== "string" ||
      typeof parsed.awayTeamId !== "string" ||
      !Array.isArray(parsed.drives)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

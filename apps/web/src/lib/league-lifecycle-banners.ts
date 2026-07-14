import type { PlayoffHandoffState } from "@/lib/playoff-handoff";

export type LeagueLifecycleBanner =
  | {
      kind: "champion";
      teamName: string | null;
      seasonName: string;
    }
  | {
      kind: "playoff-handoff";
      state: Extract<PlayoffHandoffState, "start" | "waiting">;
      progressFinal: number;
      progressTotal: number;
    };

/**
 * League info destination banners (WSM-000254): champion when decided;
 * regular-season-complete handoff when playoffs have not started.
 */
export function resolveLeagueLifecycleBanner(input: {
  champion: { teamId: string; teamName: string | null } | null;
  seasonName: string | null;
  handoff: PlayoffHandoffState;
  progressFinal: number;
  progressTotal: number;
}): LeagueLifecycleBanner | null {
  if (input.champion && input.seasonName) {
    return {
      kind: "champion",
      teamName: input.champion.teamName,
      seasonName: input.seasonName,
    };
  }
  if (input.handoff === "start" || input.handoff === "waiting") {
    return {
      kind: "playoff-handoff",
      state: input.handoff,
      progressFinal: input.progressFinal,
      progressTotal: input.progressTotal,
    };
  }
  return null;
}

/**
 * Dynasty panel presentation helpers — season state and rollover preconditions.
 */
import { isSeasonDecided } from "@/lib/dynasty";
import { regularSeasonProgress } from "@/lib/playoffs";
import type { FixtureDto } from "@sports-management/shared-types";
import type { PlayoffBracketDto } from "@/lib/data-api";

export type DynastySeasonDisplayStatus =
  | "no_season"
  | "in_progress"
  | "decided"
  | "offseason_upcoming";

export interface DynastySeasonState {
  seasonName: string | null;
  status: DynastySeasonDisplayStatus;
  statusLabel: string;
}

export interface StartNextSeasonGate {
  canStart: boolean;
  errorCode: string | null;
  message: string | null;
}

export interface SeasonDecidedContext {
  seasonDecided: boolean;
  unplayedGames: number;
  playoffsUndecided: boolean;
}

/** Derive decided-state context for rollover gating and user messaging. */
export function seasonDecidedContext(
  fixtures: FixtureDto[],
  bracket: PlayoffBracketDto | null,
): SeasonDecidedContext {
  const hasBracket = Boolean(bracket && bracket.matchups.length > 0);
  const seasonDecided = isSeasonDecided(fixtures, bracket);
  const progress = regularSeasonProgress(fixtures);
  const unplayedGames = Math.max(0, progress.total - progress.final);
  return {
    seasonDecided,
    unplayedGames,
    playoffsUndecided: hasBracket && !seasonDecided,
  };
}

/** Human-readable season line for the dynasty panel header. */
export function dynastySeasonState(input: {
  activeSeason: { name: string } | null;
  upcomingSeason: { name: string } | null;
  seasonDecided: boolean;
}): DynastySeasonState {
  if (!input.activeSeason) {
    return {
      seasonName: null,
      status: "no_season",
      statusLabel: "No active season",
    };
  }
  if (input.upcomingSeason) {
    return {
      seasonName: input.activeSeason.name,
      status: "offseason_upcoming",
      statusLabel: `Offseason · upcoming ${input.upcomingSeason.name}`,
    };
  }
  if (input.seasonDecided) {
    return {
      seasonName: input.activeSeason.name,
      status: "decided",
      statusLabel: "Decided",
    };
  }
  return {
    seasonName: input.activeSeason.name,
    status: "in_progress",
    statusLabel: "In progress",
  };
}

/** Map rollover error codes to user-facing precondition text. */
export function startNextSeasonErrorMessage(
  errorCode: string,
  context: {
    unplayedGames?: number;
    playoffsUndecided?: boolean;
    upcomingSeason?: { id: string; name: string } | null;
  } = {},
): string {
  switch (errorCode) {
    case "no_season":
      return "Create an active season before starting the next year.";
    case "not_authorized":
      return "You don't have permission to start the next season.";
    case "unauthorized":
      return "Please sign in.";
    case "next_season_exists":
      return context.upcomingSeason
        ? `An upcoming season already exists (${context.upcomingSeason.name}).`
        : "An upcoming season already exists.";
    case "season_not_decided":
      if (context.playoffsUndecided) return "Playoffs undecided.";
      if (context.unplayedGames != null && context.unplayedGames > 0) {
        const n = context.unplayedGames;
        return `${n} game${n === 1 ? "" : "s"} unplayed.`;
      }
      return "The current season is not decided yet.";
    default:
      return errorCode;
  }
}

/** Evaluate whether the Start next season CTA should be enabled. */
export function evaluateStartNextSeason(input: {
  activeSeason: { id: string; name: string } | null;
  upcomingSeason: { id: string; name: string } | null;
  seasonDecided: boolean;
  unplayedGames: number;
  playoffsUndecided: boolean;
}): StartNextSeasonGate {
  if (!input.activeSeason) {
    return {
      canStart: false,
      errorCode: "no_season",
      message: startNextSeasonErrorMessage("no_season"),
    };
  }
  if (input.upcomingSeason) {
    return {
      canStart: false,
      errorCode: "next_season_exists",
      message: startNextSeasonErrorMessage("next_season_exists", {
        upcomingSeason: input.upcomingSeason,
      }),
    };
  }
  if (!input.seasonDecided) {
    return {
      canStart: false,
      errorCode: "season_not_decided",
      message: startNextSeasonErrorMessage("season_not_decided", {
        unplayedGames: input.unplayedGames,
        playoffsUndecided: input.playoffsUndecided,
      }),
    };
  }
  return { canStart: true, errorCode: null, message: null };
}

/** Whether gamecast should deep-link to the league dynasty panel. */
export function shouldShowDynastyCta(input: {
  gameFinal: boolean;
  seasonDecided: boolean;
  upcomingSeasonExists: boolean;
}): boolean {
  return (
    input.gameFinal &&
    input.seasonDecided &&
    !input.upcomingSeasonExists
  );
}

/** Format a successful rollover summary from action counts. */
export function formatRolloverSuccessSummary(counts: {
  graduated: number;
  advanced: number;
  freshmen: number;
  progressed?: number;
}): string {
  const parts = [
    `${counts.graduated} graduated`,
    `${counts.advanced} advanced`,
    `${counts.freshmen} freshman${counts.freshmen === 1 ? "" : "en"} generated`,
  ];
  if (counts.progressed != null && counts.progressed > 0) {
    parts.push(`${counts.progressed} attribute snapshot${counts.progressed === 1 ? "" : "s"} written`);
  }
  return parts.join(" · ");
}

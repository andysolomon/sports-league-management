/*
 * Dynasty narrative templates (F4).
 *
 * Every user-facing headline in the news feed, season recap and record-broken
 * notices is rendered HERE, from deterministic templates, and stored on the
 * event row. Two consequences, both deliberate:
 *
 * 1. Copy has ONE source of truth. The Next layer renders `event.headline`; it
 *    never re-derives wording from a payload, so a feed card, a recap block and
 *    a notification cannot drift apart.
 * 2. Copy is unit-testable. Same input, byte-identical output — no model
 *    generation anywhere in this path.
 *
 * Adding an event type means adding a case here. `renderHeadline` returns a
 * usable fallback rather than throwing on an unknown type: a missing template
 * should degrade to a plain sentence in the feed, never fail the mutation that
 * was recording real game state.
 */

export type EventCategory =
  | "game"
  | "injury"
  | "roster"
  | "award"
  | "program"
  | "offseason"
  | "poll"
  | "record";

export type EventSeverity = "info" | "notable" | "headline";

/** Payloads per event type. Extended as each epic adds its producers. */
export type NarrativeInput =
  | {
      type: "game_final";
      winnerName: string;
      loserName: string;
      winnerScore: number;
      loserScore: number;
      tie: boolean;
      week: number | null;
    }
  | {
      type: "season_completed";
      seasonName: string;
      championName: string | null;
    }
  | {
      type: "player_injured";
      playerName: string;
      teamName: string;
      label: string;
      gamesOut: number;
      week: number | null;
    }
  | {
      type: "transfer_completed";
      playerName: string;
      fromTeamName: string;
      toTeamName: string;
      position: string;
    }
  | {
      type: "transfer_retained";
      playerName: string;
      teamName: string;
      position: string;
    }
  | {
      type: "coach_fired";
      coachName: string;
      teamName: string;
      seasonName: string;
    }
  | {
      type: "award_won";
      recipientName: string;
      awardName: string;
      positionGroup: string | null;
    };

export type NarrativeEventType = NarrativeInput["type"];

/** Every type currently passed by an `emitDynastyEvent` producer. */
export const PRODUCING_EVENT_TYPES = [
  "game_final",
  "player_injured",
  "transfer_completed",
  "transfer_retained",
  "coach_fired",
  "award_won",
] as const satisfies readonly NarrativeEventType[];

/** Includes supported lifecycle copy that does not yet have a producer. */
export const NARRATIVE_EVENT_TYPES = [
  ...PRODUCING_EVENT_TYPES,
  "season_completed",
] as const satisfies readonly NarrativeEventType[];

export function isNarrativeEventType(
  value: string,
): value is NarrativeEventType {
  return (NARRATIVE_EVENT_TYPES as readonly string[]).includes(value);
}

/** Ordinal-free week phrasing: "Week 7" reads better than "the 7th week". */
function weekPrefix(week: number | null): string {
  return week === null ? "" : `Week ${week}: `;
}

/**
 * Render the stored headline for an event. Deterministic and total — an
 * unrecognized type yields a readable fallback rather than throwing.
 */
export function renderHeadline(input: NarrativeInput): string {
  switch (input.type) {
    case "game_final": {
      if (input.tie) {
        return `${weekPrefix(input.week)}${input.winnerName} and ${input.loserName} play to a ${input.winnerScore}-${input.loserScore} tie`;
      }
      const margin = input.winnerScore - input.loserScore;
      // A one-score game and a blowout are different stories; say so.
      const verb =
        margin >= 21 ? "routs" : margin >= 9 ? "beats" : "edges";
      return `${weekPrefix(input.week)}${input.winnerName} ${verb} ${input.loserName} ${input.winnerScore}-${input.loserScore}`;
    }
    case "season_completed": {
      return input.championName
        ? `${input.seasonName}: ${input.championName} wins the championship`
        : `${input.seasonName} is in the books`;
    }
    case "player_injured": {
      const duration =
        input.gamesOut <= 0
          ? "and is day to day"
          : `and is out ${input.gamesOut} game${input.gamesOut === 1 ? "" : "s"}`;
      return `${weekPrefix(input.week)}${input.teamName}'s ${input.playerName} was hurt ${duration}`;
    }
    case "transfer_completed": {
      return `${input.playerName} (${input.position}) transfers from ${input.fromTeamName} to ${input.toTeamName}`;
    }
    case "transfer_retained": {
      // The non-move is news too — a program talking a player out of leaving
      // is exactly the kind of thing a dynasty should remember.
      return `${input.teamName} keeps ${input.playerName} (${input.position})`;
    }
    case "coach_fired": {
      return `${input.seasonName}: ${input.teamName} parts ways with ${input.coachName}`;
    }
    case "award_won": {
      const position = input.positionGroup
        ? ` (${input.positionGroup})`
        : "";
      return `${input.recipientName}${position} earns ${input.awardName} honors`;
    }
    default: {
      // Exhaustiveness guard: adding a NarrativeInput variant without a case
      // here fails `tsc`, so a new event type cannot ship copy-less.
      const _exhaustive: never = input;
      void _exhaustive;
      return "A notable dynasty event occurred";
    }
  }
}

/** Default severity per event type, overridable at the call site. */
export function defaultSeverity(type: NarrativeEventType): EventSeverity {
  switch (type) {
    case "game_final":
      return "info";
    case "season_completed":
      return "headline";
    case "player_injured":
      // A knock is background; anything costing games is worth surfacing.
      return "info";
    case "transfer_completed":
      // A roster changing hands between programs is the offseason's headline.
      return "notable";
    case "transfer_retained":
      return "info";
    case "coach_fired":
      return "headline";
    case "award_won":
      return "notable";
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return "info";
    }
  }
}

/** Category each event type belongs to. */
export function categoryFor(type: NarrativeEventType): EventCategory {
  switch (type) {
    case "game_final":
      return "game";
    case "season_completed":
      return "program";
    case "player_injured":
      return "game";
    case "transfer_completed":
    case "transfer_retained":
      return "offseason";
    case "coach_fired":
      return "program";
    case "award_won":
      return "award";
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return "game";
    }
  }
}

/*
 * Dedupe keys.
 *
 * The key identifies the HAPPENING, not the write. It must exclude anything
 * that can change while the happening stays the same — the engine version
 * above all, so a re-sim updates rather than duplicates.
 */
export function gameFinalDedupeKey(fixtureId: string): string {
  return `game_final:${fixtureId}`;
}

export function seasonCompletedDedupeKey(seasonId: string): string {
  return `season_completed:${seasonId}`;
}

/*
 * Keyed on the TRANSFER ROW, not on the player and season.
 *
 * A player can be offered to several programs and can be looked at again in a
 * later window; the happening being recorded is "this decision resolved this
 * way". Keying on the player would make a retained-then-released player
 * overwrite his own history, which is precisely the story worth keeping.
 */
export function transferResolvedDedupeKey(transferId: string): string {
  return `transfer_resolved:${transferId}`;
}

export interface HallOfFameCitationInput {
  recipientName: string;
  kind: "player" | "coach";
  seasonsPlayed: number;
  careerProduction: number;
  careerWins: number;
  accolades: number;
  championships: number;
  peakOverall: number;
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Hall of Fame citations share the narrative template library used by the
 * recap and news feed. Stored copy is deterministic and makes no network call.
 */
export function renderHallOfFameCitation(
  input: HallOfFameCitationInput,
): string {
  const seasons = countLabel(input.seasonsPlayed, "season");
  const honors = countLabel(input.accolades, "career honor");
  const titles = countLabel(input.championships, "championship");
  if (input.kind === "coach") {
    return `${input.recipientName} is inducted after ${seasons}, ${countLabel(input.careerWins, "win")}, ${honors}, and ${titles}.`;
  }
  const peak =
    input.peakOverall > 0
      ? ` and a peak overall of ${input.peakOverall}`
      : "";
  return `${input.recipientName} is inducted after ${seasons}, ${input.careerProduction.toLocaleString("en-US")} career production, ${honors}, and ${titles}${peak}.`;
}

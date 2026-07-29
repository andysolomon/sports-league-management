export const HOF_WAITING_SEASONS = 3;
export const HOF_CLASS_SIZE = 3;

export interface HofScoreInput {
  careerTotals: number;
  accolades: number;
  championships: number;
  peakOverall: number;
}

export interface HallOfFameCandidate extends HofScoreInput {
  recipientId: string;
  kind: "player" | "coach";
  seasonsPlayed: number;
  lastPlayedSeasonIndex: number;
}

export interface EligibleClassOptions {
  inductionSeasonIndex: number;
  inductedRecipientIds: ReadonlySet<string> | readonly string[];
  waitingSeasons?: number;
  classSize?: number;
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * A transparent, monotonic Hall of Fame score.
 *
 * Career production is already normalized by each candidate producer (raw
 * player production; coach wins × 100). The positive weights make every input
 * independently monotonic: improving one dimension can never lower the score.
 */
export function hofScore(input: HofScoreInput): number {
  return (
    nonNegativeFinite(input.careerTotals) +
    nonNegativeFinite(input.accolades) * 250 +
    nonNegativeFinite(input.championships) * 500 +
    nonNegativeFinite(input.peakOverall) * 2
  );
}

/**
 * Select one deterministic class from candidates whose careers ended at least
 * three completed seasons ago. Existing inductees and zero-season players are
 * excluded before ranking, so retries and future classes cannot duplicate one.
 */
export function eligibleClass<T extends HallOfFameCandidate>(
  candidates: readonly T[],
  options: EligibleClassOptions,
): Array<T & { score: number }> {
  const inducted =
    options.inductedRecipientIds instanceof Set
      ? options.inductedRecipientIds
      : new Set(options.inductedRecipientIds);
  const waitingSeasons = Math.max(
    0,
    Math.floor(options.waitingSeasons ?? HOF_WAITING_SEASONS),
  );
  const classSize = Math.max(
    0,
    Math.floor(options.classSize ?? HOF_CLASS_SIZE),
  );

  return candidates
    .filter(
      (candidate) =>
        !inducted.has(candidate.recipientId) &&
        candidate.seasonsPlayed > 0 &&
        options.inductionSeasonIndex - candidate.lastPlayedSeasonIndex >=
          waitingSeasons,
    )
    .map((candidate) => ({ ...candidate, score: hofScore(candidate) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.kind.localeCompare(b.kind) ||
        a.recipientId.localeCompare(b.recipientId),
    )
    .slice(0, classSize);
}

/*
 * Offseason transfers (Dynasty Mode B4) — pure, Convex-free.
 *
 * A talented junior buried on the depth chart goes looking for snaps. That one
 * sentence is the whole model, and everything here follows from it.
 *
 * ## Transfers are CONSERVED, not generated
 *
 * Every inbound offer originates from a specific outbound player on a specific
 * roster. Nobody arrives from outside the league. That is a deliberate choice
 * over the easier alternative of synthesising newcomers:
 *
 * - League talent stays constant, so transfers redistribute rather than inflate.
 *   A commissioner who runs ten offseasons does not end up with a league of
 *   ninety-overall rosters.
 * - Every move has two sides. One program's gain is visibly another's loss,
 *   which is what makes the panel worth reading.
 * - The roster cap becomes trivially satisfiable: a conserved move cannot grow
 *   total headcount, so only the DESTINATION needs a ceiling check.
 *
 * ## The two-sided resolution
 *
 * The outbound row is the player's intent and the losing coach's decision; the
 * inbound rows are offers to everyone else. A coach who retains his player
 * withdraws every offer for him. A coach who lets him go puts him on the
 * market, and the first destination to accept gets him — withdrawing the rest.
 *
 * Modelling it as one decision would have been simpler and worse: "your best
 * backup wants out and you cannot argue" is an event, not a mechanic.
 */
import { rngFor } from "./rng";
import { MAX_TARGET_ROSTER_SIZE } from "./offseason";
import type { TransferVolume } from "./dynastyConfig";

export type TransferDirection = "out" | "in";

/**
 * `pending` → the decision is open.
 * `accepted` / `rejected` → the row's own coach decided.
 * `withdrawn` → the decision was taken away by another row resolving (the
 *   player was retained, or a rival destination signed him first). Distinct
 *   from `rejected` on purpose: "we passed" and "we never got the chance" are
 *   different stories, and collapsing them would make the panel lie about who
 *   decided what.
 */
export type TransferStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export const TRANSFER_STATUSES: readonly TransferStatus[] = [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
];

export function isTransferStatus(value: string): value is TransferStatus {
  return (TRANSFER_STATUSES as readonly string[]).includes(value);
}

/** Why a player is looking. Shown to the coach — it is the argument he answers. */
export type TransferReason = "buried" | "role" | "opportunity";

export const TRANSFER_REASON_LABELS: Record<TransferReason, string> = {
  buried: "Buried on the depth chart",
  role: "Wants a bigger role",
  opportunity: "Looking for a better fit",
};

/**
 * How hard the volume knob pushes. Multiplies the per-player likelihood, so
 * `low` is a quiet year rather than a different mechanic.
 */
export const TRANSFER_VOLUME_RATE: Record<TransferVolume, number> = {
  low: 0.4,
  normal: 1,
  high: 1.9,
};

/** Destinations offered per outbound player. */
export const OFFERS_PER_TRANSFER = 2;

/** Ceiling on any single player's chance of leaving. Nobody is certain. */
const MAX_LIKELIHOOD = 0.85;

/**
 * Grades that can transfer, and how strongly.
 *
 * 12 is absent, not zero: a senior is graduating, so "he might transfer" is not
 * a quieter version of the same story — it is a different one that cannot
 * happen. Freshmen are damped because a player who arrived four months ago
 * leaving immediately reads as churn rather than as drama.
 */
const GRADE_WEIGHT: Record<number, number> = { 9: 0.45, 10: 1, 11: 1.15 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface LikelihoodInput {
  /** 1 is the starter at his slot. Higher is further down. */
  depthRank: number;
  /** 40–99 rating. */
  overall: number;
  grade: number | null;
  volume: TransferVolume;
}

/**
 * How likely this player is to look elsewhere, in [0, 1].
 *
 * Talent and burial MULTIPLY rather than add. A buried scrub is not a story and
 * a starting star is not either; the transfer that hurts is the good player who
 * cannot get on the field, and only a product produces that shape. Adding them
 * would make a benchwarming 50-overall as likely to leave as a starting
 * 90-overall, which is how you get a portal full of players nobody wants.
 *
 * The small talent-only floor is the other half of realism: a star at a
 * struggling program has a reason to leave even from the top of the chart. It
 * is deliberately an order of magnitude below the burial term, so a starter is
 * always strictly less likely to leave than an identical player behind him.
 */
export function transferOutLikelihood(input: LikelihoodInput): number {
  const gradeWeight = input.grade === null ? 1 : (GRADE_WEIGHT[input.grade] ?? 0);
  if (gradeWeight === 0) return 0;

  // Rank 1 → 0, rank 5 and beyond → 1. Being third string is not much worse
  // than being fifth; the cliff is between playing and not.
  const burial = clamp((input.depthRank - 1) / 4, 0, 1);
  const talent = clamp((input.overall - 55) / 35, 0, 1);

  const floor = 0.012 * talent;
  const raw = floor + burial * (0.1 + 0.5 * talent);
  return clamp(raw * TRANSFER_VOLUME_RATE[input.volume] * gradeWeight, 0, MAX_LIKELIHOOD);
}

export interface TransferCandidate {
  playerId: string;
  teamId: string;
  position: string;
  depthRank: number;
  overall: number;
  grade: number | null;
  /** Player row status — "graduated" and anything inactive is excluded. */
  status: string;
}

export interface OutboundTransfer {
  playerId: string;
  fromTeamId: string;
  position: string;
  likelihood: number;
  reason: TransferReason;
}

export interface SlateInput {
  seasonId: string;
  candidates: readonly TransferCandidate[];
  volume: TransferVolume;
  /** `dynastyConfig.transfersEnabled`. False yields an empty slate. */
  enabled: boolean;
}

function reasonFor(candidate: TransferCandidate): TransferReason {
  if (candidate.depthRank >= 3) return "buried";
  if (candidate.depthRank === 2) return "role";
  return "opportunity";
}

/**
 * Who wants out this offseason.
 *
 * Seeded per `(playerId, seasonId)`, so re-running the window produces the same
 * slate rather than rerolling until the commissioner likes it. That is also
 * what makes the generating mutation safe to retry.
 *
 * Sorted by likelihood so the panel's top row is the player most likely to go —
 * the one whose decision actually matters — with the id as a stable tiebreak so
 * two equally likely players never swap places between reads.
 */
export function generateTransferSlate(input: SlateInput): OutboundTransfer[] {
  if (!input.enabled) return [];

  const out: OutboundTransfer[] = [];
  for (const candidate of input.candidates) {
    /*
     * A graduated player is gone, not buried. Skipping on status rather than
     * on grade alone matters because the two can disagree: the rollover marks
     * seniors graduated and leaves their grade at 12, and a league that edits
     * grades by hand can produce either without the other.
     */
    if (candidate.status === "graduated") continue;
    if (candidate.status !== "active" && candidate.status !== "Active") continue;

    const likelihood = transferOutLikelihood({
      depthRank: candidate.depthRank,
      overall: candidate.overall,
      grade: candidate.grade,
      volume: input.volume,
    });
    if (likelihood <= 0) continue;

    const roll = rngFor("transfer", candidate.playerId, input.seasonId)();
    if (roll >= likelihood) continue;

    out.push({
      playerId: candidate.playerId,
      fromTeamId: candidate.teamId,
      position: candidate.position,
      likelihood,
      reason: reasonFor(candidate),
    });
  }

  return out.sort(
    (a, b) => b.likelihood - a.likelihood || a.playerId.localeCompare(b.playerId),
  );
}

export interface DestinationTeam {
  teamId: string;
  /** Active players already on the roster. */
  rosterCount: number;
  /** How many the team already has at the outbound player's position. */
  countAtPosition: number;
}

export interface TransferOffer {
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
}

export interface MatchInput {
  seasonId: string;
  outbound: readonly OutboundTransfer[];
  /** Called per outbound player — position need is specific to him. */
  destinationsFor: (transfer: OutboundTransfer) => readonly DestinationTeam[];
}

/**
 * Which programs come calling for each outbound player.
 *
 * Offers go to the teams THINNEST at his position, because a transfer that
 * lands where nobody plays his spot is a roster move, not a story. A seeded
 * jitter breaks ties so a league whose teams all carry three receivers does not
 * send every one of them to whichever team sorts first.
 *
 * Teams at the roster ceiling are excluded here as well as at acceptance. Both
 * are needed: this keeps the panel from showing an offer that can never be
 * taken, and the acceptance check catches a roster that filled up in between.
 */
export function matchTransfersIn(input: MatchInput): TransferOffer[] {
  const offers: TransferOffer[] = [];
  for (const transfer of input.outbound) {
    const ranked = input
      .destinationsFor(transfer)
      .filter(
        (team) =>
          team.teamId !== transfer.fromTeamId &&
          team.rosterCount < MAX_TARGET_ROSTER_SIZE,
      )
      .map((team) => {
        const jitter = rngFor(
          "transfer",
          transfer.playerId,
          input.seasonId,
          team.teamId,
        )();
        return { team, score: team.countAtPosition + jitter };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, OFFERS_PER_TRANSFER);

    for (const { team } of ranked) {
      offers.push({
        playerId: transfer.playerId,
        fromTeamId: transfer.fromTeamId,
        toTeamId: team.teamId,
      });
    }
  }
  return offers;
}

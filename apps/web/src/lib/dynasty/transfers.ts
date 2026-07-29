/*
 * Offseason transfers (B4) — Next-layer entry point.
 *
 * The definition lives in `convex/lib/transfers.ts` because the Convex bundler
 * can only reach files under `convex/`, while `src/` can reach both. The slate
 * is generated inside a mutation (the rosters, depth ranks and ratings it reads
 * all live in Convex, and pulling them into Next would be dozens of round
 * trips), while the panel renders reasons and likelihoods from the same module.
 *
 * This is a re-export, NOT a copy. Same arrangement as
 * `src/lib/dynasty/scouting.ts` and for the same reason.
 */
export {
  OFFERS_PER_TRANSFER,
  TRANSFER_REASON_LABELS,
  TRANSFER_STATUSES,
  TRANSFER_VOLUME_RATE,
  generateTransferSlate,
  isTransferStatus,
  matchTransfersIn,
  transferOutLikelihood,
} from "../../../convex/lib/transfers";

export type {
  DestinationTeam,
  LikelihoodInput,
  MatchInput,
  OutboundTransfer,
  SlateInput,
  TransferCandidate,
  TransferDirection,
  TransferOffer,
  TransferReason,
  TransferStatus,
} from "../../../convex/lib/transfers";

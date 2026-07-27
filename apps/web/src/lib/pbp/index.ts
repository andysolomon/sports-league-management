export type {
  PbpDrive,
  PbpDriveEndReason,
  PbpGameInput,
  PbpGameLog,
  PbpParticipant,
  PbpParticipantRole,
  PbpPlay,
  PbpPlayType,
  PbpFeatureGates,
  PlayerSimProfile,
  SimPositionGroup,
  TeamSimProfile,
} from "./types";

/** Bump when play model / serialization changes (stored on each gamePlayLogs row). */
export const PBP_ENGINE_VERSION = "2.0.0";

/** The version every log written before Epic A carries. */
export const PBP_ENGINE_VERSION_V1 = "1.0.0";

export { simulateGameLog } from "./engine";
export {
  normalizeGameLog,
  normalizedPlays,
  logModels,
  type NormalizedGameLog,
} from "./migrate-log";
export {
  deriveStatLines,
  allPlays,
  sumTeamStatGroup,
  type DerivedPlayerStatLine,
} from "./derive-stats";

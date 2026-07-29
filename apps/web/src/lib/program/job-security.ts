/*
 * Coach job security — see `convex/lib/jobSecurity.ts`.
 */

export {
  JOB_SECURITY_FIRE_THRESHOLD,
  JOB_SECURITY_MAX,
  JOB_SECURITY_MIN,
  JOB_SECURITY_NEUTRAL,
  computeJobSecurity,
  shouldFireCoach,
} from "../../../convex/lib/jobSecurity";

export type { JobSecurityInput } from "../../../convex/lib/jobSecurity";

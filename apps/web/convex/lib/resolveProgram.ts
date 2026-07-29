/*
 * Program row resolver (Dynasty Mode C2) — pure, Convex-free.
 *
 * A team with no `teamSeasonPrograms` row is fully valid: it runs no scheme and
 * carries no prestige/goals until someone models them. `null` fields mean "not
 * modelled", never a silent default that reads as real data in the UI.
 */

export interface TeamSeasonProgramFields {
  prestige?: number;
  facilitiesTier?: number;
  seasonGoalsJson?: string;
  jobSecurity?: number;
  boosterConfidence?: number;
}

export interface ResolvedProgram {
  prestige: number | null;
  facilitiesTier: number | null;
  seasonGoalsJson: string | null;
  jobSecurity: number | null;
  boosterConfidence: number | null;
}

export function resolveProgram(
  doc: TeamSeasonProgramFields | null | undefined,
): ResolvedProgram {
  if (!doc) {
    return {
      prestige: null,
      facilitiesTier: null,
      seasonGoalsJson: null,
      jobSecurity: null,
      boosterConfidence: null,
    };
  }
  return {
    prestige: doc.prestige ?? null,
    facilitiesTier: doc.facilitiesTier ?? null,
    seasonGoalsJson: doc.seasonGoalsJson ?? null,
    jobSecurity: doc.jobSecurity ?? null,
    boosterConfidence: doc.boosterConfidence ?? null,
  };
}

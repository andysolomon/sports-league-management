/**
 * High-school class year labels derived from grade (9–12 ↔ FR/SO/JR/SR).
 */
export type ClassYear = "FR" | "SO" | "JR" | "SR";

const GRADE_TO_CLASS: Record<number, ClassYear> = {
  9: "FR",
  10: "SO",
  11: "JR",
  12: "SR",
};

/** Map grade 9–12 to FR/SO/JR/SR; null/undefined/out-of-range → null. */
export function gradeToClassYear(
  grade: number | null | undefined,
): ClassYear | null {
  if (grade == null || !Number.isFinite(grade)) return null;
  return GRADE_TO_CLASS[grade] ?? null;
}

export interface ClassDistribution {
  FR: number;
  SO: number;
  JR: number;
  SR: number;
  unknown: number;
}

export const EMPTY_CLASS_DISTRIBUTION: ClassDistribution = {
  FR: 0,
  SO: 0,
  JR: 0,
  SR: 0,
  unknown: 0,
};

/** Count active (non-graduated) players by class year across a league roster. */
export function summarizeClassDistribution(
  players: ReadonlyArray<{ grade: number | null; status: string }>,
): ClassDistribution {
  const counts = { ...EMPTY_CLASS_DISTRIBUTION };
  for (const player of players) {
    if (player.status === "graduated") continue;
    const label = gradeToClassYear(player.grade);
    if (label) counts[label] += 1;
    else counts.unknown += 1;
  }
  return counts;
}

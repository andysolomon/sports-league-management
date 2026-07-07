import { gradeToClassYear, type ClassYear } from "@/lib/class-year";

export interface FreeAgentRow {
  id: string;
  name: string;
  position: string;
  grade: number | null;
  overall: number | null;
  teamId: string;
}

export type FreeAgentSortKey = "overall" | "name";

export interface FreeAgentFilters {
  position: string;
  classYear: string;
}

export const ALL_POSITIONS = "all";
export const ALL_CLASSES = "all";

export function filterAndSortFreeAgents(
  agents: ReadonlyArray<FreeAgentRow>,
  filters: FreeAgentFilters,
  sortKey: FreeAgentSortKey,
): FreeAgentRow[] {
  let rows = [...agents];

  if (filters.position !== ALL_POSITIONS) {
    rows = rows.filter((row) => row.position === filters.position);
  }

  if (filters.classYear !== ALL_CLASSES) {
    rows = rows.filter(
      (row) => gradeToClassYear(row.grade) === (filters.classYear as ClassYear),
    );
  }

  rows.sort((a, b) => {
    if (sortKey === "name") {
      return a.name.localeCompare(b.name);
    }
    const aOvr = a.overall ?? -1;
    const bOvr = b.overall ?? -1;
    if (bOvr !== aOvr) return bOvr - aOvr;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

export function uniquePositions(
  agents: ReadonlyArray<FreeAgentRow>,
): string[] {
  return [...new Set(agents.map((a) => a.position))].sort((a, b) =>
    a.localeCompare(b),
  );
}

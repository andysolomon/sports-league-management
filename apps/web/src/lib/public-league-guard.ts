import { notFound } from "next/navigation";
import { getLeagueVisibility } from "./data-api";

/**
 * Page-level guard for public viewer routes (Phase 2 / WSM-000059).
 *
 * Throws notFound() (Next App Router pattern) when the league is
 * missing or not opted into public visibility. Use at the top of
 * any server component under `/leagues/[id]/...` that should be
 * reachable without authentication.
 *
 * No org-membership check — visibility here is the league's own
 * opt-in via `leagues.isPublic`.
 */
export async function publicLeagueGuard(leagueId: string): Promise<void> {
  const visibility = await getLeagueVisibility(leagueId);
  if (!visibility || !visibility.isPublic) {
    notFound();
  }
}

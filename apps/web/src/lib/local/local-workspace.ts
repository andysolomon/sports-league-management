import type { LeagueDto } from "@sports-management/shared-types";
import type { WorkspaceDataProvider } from "./workspace-provider";

/** Name of the implicit single league a local workspace is scoped to. */
export const DEFAULT_LOCAL_LEAGUE_NAME = "My Program";

/**
 * A local workspace is implicitly ONE league (RFC §6) — the coach never picks an
 * org or league. Return the existing league, or create the default one on first
 * use. Idempotent: repeated calls return the same league.
 */
export async function ensureLocalWorkspace(
  provider: WorkspaceDataProvider,
): Promise<LeagueDto> {
  const leagues = await provider.listLeagues();
  if (leagues.length > 0) return leagues[0];
  return provider.createLeague({ name: DEFAULT_LOCAL_LEAGUE_NAME });
}

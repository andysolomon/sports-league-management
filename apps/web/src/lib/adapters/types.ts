import type { LeagueImportPayload } from "@sports-management/api-contracts";

export interface IDataSourceAdapter {
  fetchLeagueData(): Promise<LeagueImportPayload>;
}

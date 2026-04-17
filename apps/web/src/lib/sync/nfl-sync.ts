import type { SyncReport } from "@sports-management/shared-types";
import {
  bulkImportLeague,
  readSyncConfig as readSyncConfigFromData,
  updateSyncEnabled as updateSyncEnabledInData,
  writeSyncReport,
} from "../data-api";
import { EspnNflAdapter } from "../adapters/espn-nfl";

export const readSyncConfig = readSyncConfigFromData;
export const updateSyncEnabled = updateSyncEnabledInData;

export async function syncNfl(options?: {
  skipToggleCheck?: boolean;
}): Promise<SyncReport> {
  const startedAt = new Date().toISOString();
  const adapterErrors: string[] = [];

  // Check toggle unless explicitly skipped (e.g. manual "Sync Now")
  if (!options?.skipToggleCheck) {
    const config = await readSyncConfig();
    if (!config.syncEnabled) {
      const report: SyncReport = {
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        importResult: null,
        adapterErrors: ["Sync is disabled"],
      };
      await writeSyncReport(report);
      return report;
    }
  }

  let report: SyncReport;

  try {
    const adapter = new EspnNflAdapter();
    const payload = await adapter.fetchLeagueData();
    const importResult = await bulkImportLeague(payload);

    const completedAt = new Date().toISOString();
    report = {
      startedAt,
      completedAt,
      durationMs:
        new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      importResult,
      adapterErrors,
    };
  } catch (err) {
    const completedAt = new Date().toISOString();
    report = {
      startedAt,
      completedAt,
      durationMs:
        new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      importResult: null,
      adapterErrors: [err instanceof Error ? err.message : String(err)],
    };
  }

  try {
    await writeSyncReport(report);
  } catch {
    // Don't fail the sync if report persistence fails
  }

  return report;
}

import type { SyncReport, SyncConfig } from "@sports-management/shared-types";
import { getSalesforceConnection } from "../salesforce";
import { bulkImportLeague } from "../salesforce-api";
import { EspnNflAdapter } from "../adapters/espn-nfl";

interface SyncConfigRecord {
  Id: string;
  Sync_Enabled__c: boolean;
  Last_Sync_Report__c: string | null;
}

export async function readSyncConfig(): Promise<SyncConfig> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<SyncConfigRecord>(
    "SELECT Id, Sync_Enabled__c, Last_Sync_Report__c FROM NFL_Sync_Config__c LIMIT 1",
  );

  if (result.totalSize === 0) {
    return { syncEnabled: false, lastSyncReport: null };
  }

  const rec = result.records[0];
  let lastSyncReport: SyncReport | null = null;
  if (rec.Last_Sync_Report__c) {
    try {
      lastSyncReport = JSON.parse(rec.Last_Sync_Report__c) as SyncReport;
    } catch {
      // Corrupted report — treat as null
    }
  }

  return {
    syncEnabled: rec.Sync_Enabled__c,
    lastSyncReport,
  };
}

export async function updateSyncEnabled(enabled: boolean): Promise<void> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string }>(
    "SELECT Id FROM NFL_Sync_Config__c LIMIT 1",
  );

  if (result.totalSize === 0) {
    await conn.sobject("NFL_Sync_Config__c").create({
      Sync_Enabled__c: enabled,
    });
  } else {
    await conn.sobject("NFL_Sync_Config__c").update({
      Id: result.records[0].Id,
      Sync_Enabled__c: enabled,
    });
  }
}

async function writeSyncReport(report: SyncReport): Promise<void> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string }>(
    "SELECT Id FROM NFL_Sync_Config__c LIMIT 1",
  );

  const reportJson = JSON.stringify(report);

  if (result.totalSize === 0) {
    await conn.sobject("NFL_Sync_Config__c").create({
      Sync_Enabled__c: false,
      Last_Sync_Report__c: reportJson,
    });
  } else {
    await conn.sobject("NFL_Sync_Config__c").update({
      Id: result.records[0].Id,
      Last_Sync_Report__c: reportJson,
    });
  }
}

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

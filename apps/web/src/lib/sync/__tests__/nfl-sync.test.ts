import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImportResult, SyncReport } from "@sports-management/shared-types";

const mockImportResult: ImportResult = {
  leagueId: "convex_lg_1",
  created: { leagues: 1, divisions: 2, teams: 3, players: 10 },
  updated: { leagues: 0, divisions: 0, teams: 0, players: 0 },
  errors: [],
};

const {
  mockBulkImportLeague,
  mockReadSyncConfig,
  mockUpdateSyncEnabled,
  mockWriteSyncReport,
} = vi.hoisted(() => ({
  mockBulkImportLeague: vi.fn(),
  mockReadSyncConfig: vi.fn(),
  mockUpdateSyncEnabled: vi.fn(),
  mockWriteSyncReport: vi.fn(),
}));

vi.mock("../../data-api", () => ({
  bulkImportLeague: mockBulkImportLeague,
  readSyncConfig: mockReadSyncConfig,
  updateSyncEnabled: mockUpdateSyncEnabled,
  writeSyncReport: mockWriteSyncReport,
}));

const mockFetchLeagueData = vi.fn();
vi.mock("../../adapters/espn-nfl", () => ({
  EspnNflAdapter: class {
    fetchLeagueData = mockFetchLeagueData;
  },
}));

import { syncNfl, readSyncConfig, updateSyncEnabled } from "../nfl-sync";

describe("NFL Sync Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLeagueData.mockResolvedValue({
      league: { name: "NFL" },
      divisions: [],
    });
    mockBulkImportLeague.mockResolvedValue(mockImportResult);
    mockReadSyncConfig.mockResolvedValue({
      syncEnabled: true,
      lastSyncReport: null,
    });
    mockWriteSyncReport.mockResolvedValue(undefined);
    mockUpdateSyncEnabled.mockResolvedValue(undefined);
  });

  describe("readSyncConfig (re-exported from data-api)", () => {
    it("returns disabled config from data-api", async () => {
      mockReadSyncConfig.mockResolvedValueOnce({
        syncEnabled: false,
        lastSyncReport: null,
      });
      const config = await readSyncConfig();
      expect(config.syncEnabled).toBe(false);
      expect(config.lastSyncReport).toBeNull();
    });

    it("returns enabled config with last sync report", async () => {
      const report: SyncReport = {
        startedAt: "2026-04-13T00:00:00Z",
        completedAt: "2026-04-13T00:01:00Z",
        durationMs: 60000,
        importResult: mockImportResult,
        adapterErrors: [],
      };
      mockReadSyncConfig.mockResolvedValueOnce({
        syncEnabled: true,
        lastSyncReport: report,
      });

      const config = await readSyncConfig();
      expect(config.syncEnabled).toBe(true);
      expect(config.lastSyncReport).toEqual(report);
    });
  });

  describe("updateSyncEnabled (re-exported from data-api)", () => {
    it("forwards the toggle to the Convex mutation", async () => {
      await updateSyncEnabled(true);
      expect(mockUpdateSyncEnabled).toHaveBeenCalledWith(true);

      await updateSyncEnabled(false);
      expect(mockUpdateSyncEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe("syncNfl", () => {
    it("returns early when sync is disabled", async () => {
      mockReadSyncConfig.mockResolvedValueOnce({
        syncEnabled: false,
        lastSyncReport: null,
      });

      const report = await syncNfl();
      expect(report.importResult).toBeNull();
      expect(report.adapterErrors).toContain("Sync is disabled");
      expect(mockFetchLeagueData).not.toHaveBeenCalled();
      // The disabled-path still persists a report so the UI sees it.
      expect(mockWriteSyncReport).toHaveBeenCalled();
    });

    it("skips toggle check when skipToggleCheck is true", async () => {
      const report = await syncNfl({ skipToggleCheck: true });
      expect(report.importResult).toEqual(mockImportResult);
      expect(mockFetchLeagueData).toHaveBeenCalled();
      expect(mockReadSyncConfig).not.toHaveBeenCalled();
    });

    it("runs full sync when enabled", async () => {
      const report = await syncNfl();
      expect(report.importResult).toEqual(mockImportResult);
      expect(report.adapterErrors).toHaveLength(0);
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockBulkImportLeague).toHaveBeenCalled();
    });

    it("captures adapter errors in report", async () => {
      mockFetchLeagueData.mockRejectedValue(new Error("ESPN API down"));

      const report = await syncNfl({ skipToggleCheck: true });
      expect(report.importResult).toBeNull();
      expect(report.adapterErrors).toContain("ESPN API down");
    });

    it("persists the sync report to Convex on completion", async () => {
      await syncNfl({ skipToggleCheck: true });

      expect(mockWriteSyncReport).toHaveBeenCalledTimes(1);
      const saved = mockWriteSyncReport.mock.calls[0][0] as SyncReport;
      expect(saved.importResult).toEqual(mockImportResult);
      expect(saved.adapterErrors).toHaveLength(0);
    });
  });
});

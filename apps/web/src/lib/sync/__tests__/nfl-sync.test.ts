import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImportResult } from "@sports-management/shared-types";

const mockImportResult: ImportResult = {
  leagueId: "a00FAKE",
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
  mockBulkImportLeague: vi.fn(() => Promise.resolve(mockImportResult)),
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

// Mock ESPN adapter
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
  });

  describe("readSyncConfig", () => {
    it("returns disabled config when no record exists", async () => {
      mockReadSyncConfig.mockResolvedValue({
        syncEnabled: false,
        lastSyncReport: null,
      });
      const config = await readSyncConfig();
      expect(config.syncEnabled).toBe(false);
      expect(config.lastSyncReport).toBeNull();
    });

    it("reads enabled config with last sync report", async () => {
      const report = {
        startedAt: "2026-04-13T00:00:00Z",
        completedAt: "2026-04-13T00:01:00Z",
        durationMs: 60000,
        importResult: mockImportResult,
        adapterErrors: [],
      };
      mockReadSyncConfig.mockResolvedValue({
        syncEnabled: true,
        lastSyncReport: report,
      });

      const config = await readSyncConfig();
      expect(config.syncEnabled).toBe(true);
      expect(config.lastSyncReport).toEqual(report);
    });

    it("handles corrupted report JSON gracefully", async () => {
      mockReadSyncConfig.mockResolvedValue({
        syncEnabled: true,
        lastSyncReport: null,
      });

      const config = await readSyncConfig();
      expect(config.syncEnabled).toBe(true);
      expect(config.lastSyncReport).toBeNull();
    });
  });

  describe("updateSyncEnabled", () => {
    it("delegates config writes to the data layer", async () => {
      await updateSyncEnabled(true);
      expect(mockUpdateSyncEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe("syncNfl", () => {
    it("returns early when sync is disabled", async () => {
      mockReadSyncConfig.mockResolvedValue({
        syncEnabled: false,
        lastSyncReport: null,
      });

      const report = await syncNfl();
      expect(report.importResult).toBeNull();
      expect(report.adapterErrors).toContain("Sync is disabled");
      expect(mockFetchLeagueData).not.toHaveBeenCalled();
      expect(mockWriteSyncReport).toHaveBeenCalledWith(
        expect.objectContaining({ importResult: null }),
      );
    });

    it("skips toggle check when skipToggleCheck is true", async () => {
      const report = await syncNfl({ skipToggleCheck: true });
      expect(report.importResult).toEqual(mockImportResult);
      expect(mockFetchLeagueData).toHaveBeenCalled();
      expect(mockReadSyncConfig).not.toHaveBeenCalled();
    });

    it("runs full sync when enabled", async () => {
      mockReadSyncConfig.mockResolvedValue({
        syncEnabled: true,
        lastSyncReport: null,
      });

      const report = await syncNfl();
      expect(report.importResult).toEqual(mockImportResult);
      expect(report.adapterErrors).toHaveLength(0);
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockBulkImportLeague).toHaveBeenCalled();
    });

    it("captures adapter errors in report", async () => {
      mockReadSyncConfig.mockResolvedValue({
        syncEnabled: true,
        lastSyncReport: null,
      });
      mockFetchLeagueData.mockRejectedValue(new Error("ESPN API down"));

      const report = await syncNfl({ skipToggleCheck: true });
      expect(report.importResult).toBeNull();
      expect(report.adapterErrors).toContain("ESPN API down");
    });

    it("writes the sync report through the data layer", async () => {
      mockReadSyncConfig.mockResolvedValue({
        syncEnabled: true,
        lastSyncReport: null,
      });

      await syncNfl({ skipToggleCheck: true });

      expect(mockWriteSyncReport).toHaveBeenCalledWith(
        expect.objectContaining({
          importResult: mockImportResult,
          adapterErrors: [],
        }),
      );
    });
  });
});

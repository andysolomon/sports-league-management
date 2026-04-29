import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImportResult } from "@sports-management/shared-types";

// Mock salesforce connection
const mockQuery = vi.fn();
const mockSobjectCreate = vi.fn();
const mockSobjectUpdate = vi.fn();
const mockSobject = vi.fn(() => ({
  create: mockSobjectCreate,
  update: mockSobjectUpdate,
}));
const mockConn = {
  query: mockQuery,
  sobject: mockSobject,
  instanceUrl: "https://test.salesforce.com",
  request: vi.fn(),
};

vi.mock("../../salesforce", () => ({
  getSalesforceConnection: vi.fn(() => Promise.resolve(mockConn)),
}));

// Mock bulkImportLeague
const mockImportResult: ImportResult = {
  leagueId: "a00FAKE",
  created: { leagues: 1, divisions: 2, teams: 3, players: 10 },
  updated: { leagues: 0, divisions: 0, teams: 0, players: 0 },
  errors: [],
};

vi.mock("../../data-api", () => ({
  bulkImportLeague: vi.fn(() => Promise.resolve(mockImportResult)),
}));

// Mock ESPN adapter
const mockFetchLeagueData = vi.fn();
vi.mock("../../adapters/espn-nfl", () => ({
  EspnNflAdapter: class {
    fetchLeagueData = mockFetchLeagueData;
  },
}));

import { syncNfl, readSyncConfig, updateSyncEnabled } from "../nfl-sync";
import { bulkImportLeague } from "../../data-api";

describe("NFL Sync Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLeagueData.mockResolvedValue({
      league: { name: "NFL" },
      divisions: [],
    });
    mockSobjectCreate.mockResolvedValue({ success: true, id: "a00NEW" });
    mockSobjectUpdate.mockResolvedValue({ success: true });
  });

  describe("readSyncConfig", () => {
    it("returns disabled config when no record exists", async () => {
      mockQuery.mockResolvedValue({ totalSize: 0, records: [] });
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
      mockQuery.mockResolvedValue({
        totalSize: 1,
        records: [
          {
            Id: "a00CONFIG",
            Sync_Enabled__c: true,
            Last_Sync_Report__c: JSON.stringify(report),
          },
        ],
      });

      const config = await readSyncConfig();
      expect(config.syncEnabled).toBe(true);
      expect(config.lastSyncReport).toEqual(report);
    });

    it("handles corrupted report JSON gracefully", async () => {
      mockQuery.mockResolvedValue({
        totalSize: 1,
        records: [
          {
            Id: "a00CONFIG",
            Sync_Enabled__c: true,
            Last_Sync_Report__c: "not-json",
          },
        ],
      });

      const config = await readSyncConfig();
      expect(config.syncEnabled).toBe(true);
      expect(config.lastSyncReport).toBeNull();
    });
  });

  describe("updateSyncEnabled", () => {
    it("creates config record if none exists", async () => {
      mockQuery.mockResolvedValue({ totalSize: 0, records: [] });
      await updateSyncEnabled(true);
      expect(mockSobject).toHaveBeenCalledWith("NFL_Sync_Config__c");
      expect(mockSobjectCreate).toHaveBeenCalledWith({
        Sync_Enabled__c: true,
      });
    });

    it("updates existing config record", async () => {
      mockQuery.mockResolvedValue({
        totalSize: 1,
        records: [{ Id: "a00CONFIG" }],
      });
      await updateSyncEnabled(false);
      expect(mockSobjectUpdate).toHaveBeenCalledWith({
        Id: "a00CONFIG",
        Sync_Enabled__c: false,
      });
    });
  });

  describe("syncNfl", () => {
    it("returns early when sync is disabled", async () => {
      mockQuery.mockResolvedValue({
        totalSize: 1,
        records: [
          {
            Id: "a00CONFIG",
            Sync_Enabled__c: false,
            Last_Sync_Report__c: null,
          },
        ],
      });

      const report = await syncNfl();
      expect(report.importResult).toBeNull();
      expect(report.adapterErrors).toContain("Sync is disabled");
      expect(mockFetchLeagueData).not.toHaveBeenCalled();
    });

    it("skips toggle check when skipToggleCheck is true", async () => {
      // First call: readSyncConfig query (skipped with skipToggleCheck)
      // Only query calls will be for writeSyncReport
      mockQuery.mockResolvedValue({
        totalSize: 1,
        records: [{ Id: "a00CONFIG" }],
      });

      const report = await syncNfl({ skipToggleCheck: true });
      expect(report.importResult).toEqual(mockImportResult);
      expect(mockFetchLeagueData).toHaveBeenCalled();
    });

    it("runs full sync when enabled", async () => {
      // readSyncConfig query
      mockQuery.mockResolvedValueOnce({
        totalSize: 1,
        records: [
          {
            Id: "a00CONFIG",
            Sync_Enabled__c: true,
            Last_Sync_Report__c: null,
          },
        ],
      });
      // writeSyncReport query
      mockQuery.mockResolvedValueOnce({
        totalSize: 1,
        records: [{ Id: "a00CONFIG" }],
      });

      const report = await syncNfl();
      expect(report.importResult).toEqual(mockImportResult);
      expect(report.adapterErrors).toHaveLength(0);
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
      expect(bulkImportLeague).toHaveBeenCalled();
    });

    it("captures adapter errors in report", async () => {
      mockQuery.mockResolvedValue({
        totalSize: 1,
        records: [{ Id: "a00CONFIG" }],
      });
      mockFetchLeagueData.mockRejectedValue(new Error("ESPN API down"));

      const report = await syncNfl({ skipToggleCheck: true });
      expect(report.importResult).toBeNull();
      expect(report.adapterErrors).toContain("ESPN API down");
    });

    it("writes sync report to Salesforce on completion", async () => {
      mockQuery.mockResolvedValue({
        totalSize: 1,
        records: [{ Id: "a00CONFIG" }],
      });

      await syncNfl({ skipToggleCheck: true });

      // Verify update was called with Last_Sync_Report__c
      expect(mockSobjectUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          Id: "a00CONFIG",
          Last_Sync_Report__c: expect.any(String),
        }),
      );

      const reportJson = mockSobjectUpdate.mock.calls.find(
        (call) => call[0].Last_Sync_Report__c,
      )?.[0].Last_Sync_Report__c;
      const savedReport = JSON.parse(reportJson);
      expect(savedReport.importResult).toEqual(mockImportResult);
    });
  });
});

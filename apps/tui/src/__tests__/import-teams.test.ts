import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:readline/promises", () => ({
  createInterface: vi.fn(),
}));
vi.mock("../lib/credentials.js", () => ({
  readCredentials: vi.fn(),
}));
vi.mock("../lib/config.js", () => ({
  getApiBaseUrl: vi.fn().mockReturnValue("http://test.local"),
}));

import { createInterface } from "node:readline/promises";
import { readCredentials } from "../lib/credentials.js";
import { runImportTeams } from "../commands/import-teams.js";

const mockCreds = readCredentials as unknown as ReturnType<typeof vi.fn>;
const mockRL = createInterface as unknown as ReturnType<typeof vi.fn>;

const creds = {
  apiKey: "ak_test",
  userId: "u1",
  email: "t@e.com",
  createdAt: "2026-01-01",
};

function mockReadline(answer: string) {
  mockRL.mockReturnValue({
    question: vi.fn().mockResolvedValue(answer),
    close: vi.fn(),
  });
}

describe("runImportTeams", () => {
  let tmpDir: string;
  const origFetch = global.fetch;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), "import-test-"));
  });

  afterEach(async () => {
    global.fetch = origFetch;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("throws when not authenticated", async () => {
    mockCreds.mockResolvedValue(null);
    const csvPath = join(tmpDir, "teams.csv");
    await writeFile(csvPath, "name,leagueId,city,stadium\nTeam A,lg1,NYC,Stadium 1\n");
    await expect(runImportTeams(csvPath)).rejects.toThrow("Not authenticated");
  });

  it("throws when CSV file does not exist", async () => {
    mockCreds.mockResolvedValue(creds);
    await expect(runImportTeams("/nonexistent.csv")).rejects.toThrow(
      "Cannot read file",
    );
  });

  it("throws when CSV is empty", async () => {
    mockCreds.mockResolvedValue(creds);
    const csvPath = join(tmpDir, "empty.csv");
    await writeFile(csvPath, "name,leagueId,city,stadium\n");
    await expect(runImportTeams(csvPath)).rejects.toThrow("empty");
  });

  it("creates teams when user confirms", async () => {
    mockCreds.mockResolvedValue(creds);
    mockReadline("y");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          id: "t1",
          name: "Team A",
          leagueId: "lg1",
          city: "NYC",
          stadium: "S1",
        }),
    }) as unknown as typeof fetch;

    const csvPath = join(tmpDir, "teams.csv");
    await writeFile(
      csvPath,
      "name,leagueId,city,stadium\nTeam A,lg1,NYC,Stadium 1\n",
    );

    await runImportTeams(csvPath);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("does not call API when user declines", async () => {
    mockCreds.mockResolvedValue(creds);
    mockReadline("n");
    global.fetch = vi.fn() as unknown as typeof fetch;

    const csvPath = join(tmpDir, "teams.csv");
    await writeFile(
      csvPath,
      "name,leagueId,city,stadium\nTeam A,lg1,NYC,Stadium 1\n",
    );

    await runImportTeams(csvPath);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reports validation errors for rows missing required fields", async () => {
    mockCreds.mockResolvedValue(creds);
    mockReadline("y");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "t1" }),
    }) as unknown as typeof fetch;

    const csvPath = join(tmpDir, "partial.csv");
    await writeFile(
      csvPath,
      "name,leagueId,city,stadium\nTeam A,lg1,NYC,Stadium 1\n,lg2,,\n",
    );

    // Should still import the valid row
    await runImportTeams(csvPath);
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});

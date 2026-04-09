import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  writeCredentials,
  readCredentials,
  type StoredCredentials,
} from "../lib/credentials.js";

const testCreds: StoredCredentials = {
  apiKey: "ak_TEST_KEY_123",
  userId: "user_test_456",
  email: "test@example.com",
  createdAt: "2026-04-09T00:00:00.000Z",
};

describe("credentials", () => {
  let tmpDir: string;
  const originalXdg = process.env.XDG_CONFIG_HOME;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "sprtsmng-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(async () => {
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("round-trips: write then read returns the same object", async () => {
    await writeCredentials(testCreds);
    const loaded = await readCredentials();
    expect(loaded).toEqual(testCreds);
  });

  it("creates the auth file with mode 0600", async () => {
    const path = await writeCredentials(testCreds);
    const fileStat = await stat(path);
    // 0o600 = owner read+write only (octal 0600 = decimal 384)
    expect(fileStat.mode & 0o777).toBe(0o600);
  });

  it("creates the parent directory with mode 0700", async () => {
    await writeCredentials(testCreds);
    const dirStat = await stat(join(tmpDir, "sprtsmng"));
    expect(dirStat.mode & 0o777).toBe(0o700);
  });

  it("returns null when no credentials file exists", async () => {
    const loaded = await readCredentials();
    expect(loaded).toBeNull();
  });

  it("overwrites existing credentials silently", async () => {
    await writeCredentials(testCreds);
    const newCreds: StoredCredentials = {
      ...testCreds,
      apiKey: "ak_NEW_KEY_789",
      createdAt: "2026-04-10T00:00:00.000Z",
    };
    await writeCredentials(newCreds);
    const loaded = await readCredentials();
    expect(loaded?.apiKey).toBe("ak_NEW_KEY_789");
  });
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WsmLocalDb } from "../local-db";
import { LocalWorkspaceProvider } from "../local-workspace-provider";
import {
  DEFAULT_LOCAL_LEAGUE_NAME,
  ensureLocalWorkspace,
} from "../local-workspace";

let db: WsmLocalDb;
let provider: LocalWorkspaceProvider;
let counter = 0;

beforeEach(() => {
  db = new WsmLocalDb(`wsm-local-ws-test-${counter++}`);
  provider = new LocalWorkspaceProvider(db);
});

afterEach(async () => {
  await db.delete();
});

describe("ensureLocalWorkspace", () => {
  it("creates the default league on first use", async () => {
    expect(await provider.listLeagues()).toHaveLength(0);
    const league = await ensureLocalWorkspace(provider);
    expect(league.name).toBe(DEFAULT_LOCAL_LEAGUE_NAME);
    expect(await provider.listLeagues()).toHaveLength(1);
  });

  it("is idempotent — returns the existing league without creating another", async () => {
    const first = await ensureLocalWorkspace(provider);
    const second = await ensureLocalWorkspace(provider);
    expect(second.id).toBe(first.id);
    expect(await provider.listLeagues()).toHaveLength(1);
  });

  it("returns the existing league even if it was renamed", async () => {
    const created = await provider.createLeague({ name: "Custom Name" });
    const resolved = await ensureLocalWorkspace(provider);
    expect(resolved.id).toBe(created.id);
    expect(resolved.name).toBe("Custom Name");
  });
});

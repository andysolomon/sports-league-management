import { describe, it, expect, vi } from "vitest";

vi.mock("flags/next", () => ({
  flag: <T,>(def: {
    key: string;
    decide: () => T | Promise<T>;
    defaultValue?: T;
    description?: string;
  }) => {
    const fn = async () => def.decide();
    return Object.assign(fn, def);
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    const err = new Error("NEXT_NOT_FOUND");
    (err as Error & { digest?: string }).digest = "NEXT_NOT_FOUND";
    throw err;
  }),
}));

import { depthChartV1, rosterSnapshotsV1, pageGuard, apiGuard } from "../flags";

describe("depthChartV1 flag declaration", () => {
  it("uses the canonical key", () => {
    expect(depthChartV1.key).toBe("depth_chart_v1");
  });

  it("has a description for the Vercel Toolbar", () => {
    expect(depthChartV1.description).toMatch(/depth.chart/i);
  });
});

describe("rosterSnapshotsV1 flag declaration", () => {
  it("uses the canonical key", () => {
    expect(rosterSnapshotsV1.key).toBe("roster_snapshots_v1");
  });

  it("has a Phase 1 description for the Vercel Toolbar", () => {
    expect(rosterSnapshotsV1.description).toMatch(/roster|snapshot/i);
  });
});

describe("pageGuard", () => {
  it("resolves when the flag is on", async () => {
    await expect(pageGuard(async () => true)).resolves.toBeUndefined();
  });

  it("calls notFound() when the flag is off", async () => {
    await expect(pageGuard(async () => false)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("apiGuard", () => {
  it("returns null when the flag is on", async () => {
    await expect(apiGuard(async () => true)).resolves.toBeNull();
  });

  it("returns a 403 flag_disabled response when the flag is off", async () => {
    const res = await apiGuard(async () => false);
    expect(res).toBeInstanceOf(Response);
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: "flag_disabled" });
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../analytics", () => ({
  trackFlagExposure: vi.fn(() => Promise.resolve()),
}));

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

import {
  depthChartV1,
  rosterSnapshotsV1,
  playerAttributesV1,
  schedulesStandingsV1,
  lowLatencyStreamingV1,
  pageGuard,
  apiGuard,
} from "../flags";

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

describe("playerAttributesV1 flag declaration", () => {
  it("uses the canonical key", () => {
    expect(playerAttributesV1.key).toBe("player_attributes_v1");
  });

  it("has a Phase 2 description for the Vercel Toolbar", () => {
    expect(playerAttributesV1.description).toMatch(/attribute|development/i);
  });
});

describe("schedulesStandingsV1 flag declaration", () => {
  it("uses the canonical key", () => {
    expect(schedulesStandingsV1.key).toBe("schedules_standings_v1");
  });

  it("has a Phase 3 description for the Vercel Toolbar", () => {
    expect(schedulesStandingsV1.description).toMatch(
      /schedule|standing|fixture/i,
    );
  });
});

describe("lowLatencyStreamingV1 flag declaration (WSM-000200)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the canonical key", () => {
    expect(lowLatencyStreamingV1.key).toBe("low_latency_streaming_v1");
  });

  it("has a description for the Vercel Toolbar", () => {
    expect(lowLatencyStreamingV1.description).toMatch(/low.latency|LL-HLS/i);
  });

  it("is DARK by default — unset stays off even outside production", async () => {
    // Unlike resolveFlag()-based flags (on outside prod), this must be off.
    expect(await lowLatencyStreamingV1()).toBe(false);
  });

  it('only "on" enables it', async () => {
    vi.stubEnv("FLAG_LOW_LATENCY_STREAMING_V1", "on");
    expect(await lowLatencyStreamingV1()).toBe(true);
  });

  it("ignores other values", async () => {
    vi.stubEnv("FLAG_LOW_LATENCY_STREAMING_V1", "true");
    expect(await lowLatencyStreamingV1()).toBe(false);
  });
});

describe("env override resolution (WSM-000079)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns true when the flag env var is "on"', async () => {
    vi.stubEnv("FLAG_DEPTH_CHART_V1", "on");
    expect(await depthChartV1()).toBe(true);
  });

  it('returns false when the flag env var is "off"', async () => {
    vi.stubEnv("FLAG_DEPTH_CHART_V1", "off");
    expect(await depthChartV1()).toBe(false);
  });

  it("falls back to the VERCEL_ENV default when unset (on outside production)", async () => {
    // Test env has no VERCEL_ENV, so defaultOn = true.
    expect(await depthChartV1()).toBe(true);
  });

  it("ignores unrecognized values and uses the default", async () => {
    vi.stubEnv("FLAG_DEPTH_CHART_V1", "true");
    expect(await depthChartV1()).toBe(true);
  });

  it('"on" overrides the production-off default', async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("FLAG_ROSTER_SNAPSHOTS_V1", "on");
    vi.resetModules();
    const flags = await import("../flags");
    expect(await flags.rosterSnapshotsV1()).toBe(true);
    expect(await flags.depthChartV1()).toBe(false); // unset stays dark in prod
  });

  it("each flag reads its own env key", async () => {
    vi.stubEnv("FLAG_PLAYER_ATTRIBUTES_V1", "off");
    expect(await playerAttributesV1()).toBe(false);
    expect(await schedulesStandingsV1()).toBe(true);
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

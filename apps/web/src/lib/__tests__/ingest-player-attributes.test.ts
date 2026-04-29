import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

// Stub the Convex client wrapper so we can assert the canonical payload
// the data-api layer sends on. Same pattern as other route specs.
vi.mock("../convex-client", () => ({
  getConvexClient: vi.fn().mockReturnValue({
    mutation: mockMutate,
  }),
}));

import { ingestPlayerAttributes } from "../data-api";

describe("ingestPlayerAttributes (wrapper)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mockResolvedValue({ id: "pa_1", created: true });
  });

  it("rejects when no source produces a valid normalization", async () => {
    await expect(
      ingestPlayerAttributes({
        playerId: "p_1",
        seasonId: "s_1",
        pffSource: { positionGroup: "QB", attributes: { x: "not a number" } },
      }),
    ).rejects.toThrow("ingest_no_valid_source");
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("ingests a single PFF source with weighted overall from OVR-like key", async () => {
    await ingestPlayerAttributes({
      playerId: "p_1",
      seasonId: "s_1",
      pffSource: {
        positionGroup: "QB",
        attributes: { armStrength: 92, accuracy: 88, overall: 90 },
      },
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const args = mockMutate.mock.calls[0][1] as Record<string, unknown>;
    expect(args.playerId).toBe("p_1");
    expect(args.seasonId).toBe("s_1");
    expect(args.positionGroup).toBe("QB");
    expect(args.weightedOverall).toBe(90);
    expect(args.pffSourceJson).toBeTypeOf("string");
    expect(args.maddenSourceJson).toBeNull();
    const attrs = JSON.parse(args.attributesJson as string);
    expect(attrs).toMatchObject({ armStrength: 92, accuracy: 88, overall: 90 });
  });

  it("blends PFF + Madden via per-source weights", async () => {
    await ingestPlayerAttributes({
      playerId: "p_1",
      seasonId: "s_1",
      pffSource: {
        positionGroup: "QB",
        attributes: { OVR: 80 },
      },
      maddenSource: {
        POS: "QB",
        OVR: 100,
      },
      pffWeight: 0.25,
      maddenWeight: 0.75,
    });

    const args = mockMutate.mock.calls[0][1] as Record<string, unknown>;
    // Weighted average: (80 * 0.25 + 100 * 0.75) / 1.0 = 95
    expect(args.weightedOverall).toBe(95);
    expect(args.pffSourceJson).toBeTypeOf("string");
    expect(args.maddenSourceJson).toBeTypeOf("string");
  });

  it("returns weightedOverall=null when no source carries an overall", async () => {
    await ingestPlayerAttributes({
      playerId: "p_1",
      seasonId: "s_1",
      pffSource: {
        positionGroup: "WR",
        attributes: { speed: 90, separation: 85 },
      },
    });

    const args = mockMutate.mock.calls[0][1] as Record<string, unknown>;
    expect(args.weightedOverall).toBeNull();
  });

  it("admin-only source wins (weight 1.0)", async () => {
    await ingestPlayerAttributes({
      playerId: "p_1",
      seasonId: "s_1",
      adminSource: {
        positionGroup: "QB",
        attributes: { armStrength: 88, accuracy: 90, overall: 89 },
      },
    });

    const args = mockMutate.mock.calls[0][1] as Record<string, unknown>;
    expect(args.weightedOverall).toBe(89);
    expect(args.pffSourceJson).toBeNull();
    expect(args.maddenSourceJson).toBeNull();
  });
});

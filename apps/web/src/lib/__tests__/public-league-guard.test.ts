import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetLeagueVisibility } = vi.hoisted(() => ({
  mockGetLeagueVisibility: vi.fn(),
}));

vi.mock("../data-api", () => ({
  getLeagueVisibility: mockGetLeagueVisibility,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    const err = new Error("NEXT_NOT_FOUND");
    (err as Error & { digest?: string }).digest = "NEXT_NOT_FOUND";
    throw err;
  }),
}));

import { publicLeagueGuard } from "../public-league-guard";

describe("publicLeagueGuard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves silently when the league is public", async () => {
    mockGetLeagueVisibility.mockResolvedValue({ isPublic: true });
    await expect(publicLeagueGuard("lg_pub")).resolves.toBeUndefined();
  });

  it("throws notFound() when the league is not public", async () => {
    mockGetLeagueVisibility.mockResolvedValue({ isPublic: false });
    await expect(publicLeagueGuard("lg_priv")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("throws notFound() when the league is missing", async () => {
    mockGetLeagueVisibility.mockResolvedValue(null);
    await expect(publicLeagueGuard("lg_missing")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

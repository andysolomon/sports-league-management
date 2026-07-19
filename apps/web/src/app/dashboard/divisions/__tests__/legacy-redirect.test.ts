import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn((to: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT:${to}`);
  }),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));
vi.mock("@/lib/active-league", () => ({ resolveActiveLeague: vi.fn() }));
vi.mock("@/lib/active-league-server", () => ({
  syncActiveLeagueForResource: vi.fn(),
}));
vi.mock("@/lib/data-api", () => ({ getDivision: vi.fn() }));
vi.mock("@/lib/org-context", () => ({ resolveOrgContext: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { resolveActiveLeague } from "@/lib/active-league";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";
import { getDivision } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import DivisionDetailPage from "../[id]/page";
import DivisionsPage from "../page";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockResolveActiveLeague = resolveActiveLeague as unknown as ReturnType<
  typeof vi.fn
>;
const mockSyncActiveLeagueForResource =
  syncActiveLeagueForResource as unknown as ReturnType<typeof vi.fn>;
const mockGetDivision = getDivision as unknown as ReturnType<typeof vi.fn>;
const mockResolveOrgContext = resolveOrgContext as unknown as ReturnType<
  typeof vi.fn
>;

describe("legacy Division redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1" });
  });

  it("permanently redirects the legacy Division Home after resolving scope", async () => {
    await expect(DivisionsPage()).rejects.toThrow(
      "NEXT_PERMANENT_REDIRECT:/dashboard/teams?view=divisions",
    );
    expect(mockResolveActiveLeague).toHaveBeenCalledWith("user-1");
  });

  it("validates a Division, synchronizes its League, and permanently redirects", async () => {
    mockResolveOrgContext.mockResolvedValue({
      userId: "user-1",
      orgIds: ["org-1"],
      visibleLeagueIds: ["league-1"],
    });
    mockGetDivision.mockResolvedValue({ id: "division-1", leagueId: "league-1" });

    await expect(
      DivisionDetailPage({ params: Promise.resolve({ id: "division-1" }) }),
    ).rejects.toThrow(
      "NEXT_PERMANENT_REDIRECT:/dashboard/teams?view=divisions&division=division-1",
    );
    expect(mockSyncActiveLeagueForResource).toHaveBeenCalledWith("league-1");
  });

  it("keeps inaccessible or missing Divisions non-disclosing", async () => {
    mockResolveOrgContext.mockResolvedValue({
      userId: "user-1",
      orgIds: ["org-1"],
      visibleLeagueIds: ["league-1"],
    });
    mockGetDivision.mockRejectedValue(new Error("not found"));

    await expect(
      DivisionDetailPage({ params: Promise.resolve({ id: "other-division" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockSyncActiveLeagueForResource).not.toHaveBeenCalled();
  });
});

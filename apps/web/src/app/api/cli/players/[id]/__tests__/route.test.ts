import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/data-api", () => ({ updatePlayer: vi.fn() }));
vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn(() => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "internal" }, { status: 503 });
  }),
}));

import { auth } from "@clerk/nextjs/server";
import { updatePlayer } from "@/lib/data-api";
import { PUT } from "../route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockUpdatePlayer = updatePlayer as unknown as ReturnType<typeof vi.fn>;

function makePutRequest(id: string, body: unknown) {
  return [
    new NextRequest(
      new URL(`/api/cli/players/${id}`, "http://localhost:3000"),
      {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      },
    ),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("PUT /api/cli/players/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, tokenType: null });
    const [req, ctx] = makePutRequest("p1", { teamId: "t2" });
    const res = await PUT(req, ctx);
    expect(res.status).toBe(401);
  });

  it("updates a player and returns 200", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", tokenType: "api_key" });
    mockUpdatePlayer.mockResolvedValue({
      id: "p1",
      name: "Player 1",
      teamId: "t2",
      position: "GK",
    });

    const [req, ctx] = makePutRequest("p1", { teamId: "t2" });
    const res = await PUT(req, ctx);
    expect(res.status).toBe(200);
    expect(mockUpdatePlayer).toHaveBeenCalledWith("p1", { teamId: "t2" });
  });
});

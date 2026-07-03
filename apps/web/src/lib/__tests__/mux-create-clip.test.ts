import { describe, it, expect, vi, beforeEach } from "vitest";

// mux.ts is `import "server-only"`; neutralize that guard for the test runner.
vi.mock("server-only", () => ({}));

// Mock the Mux SDK to capture asset create/delete calls (WSM-000201).
let createImpl: (params: unknown) => Promise<unknown>;
let deleteImpl: (assetId: string) => Promise<void>;
let lastCreateParams: unknown;
vi.mock("@mux/mux-node", () => {
  return {
    default: class MockMux {
      video = {
        assets: {
          create: (params: unknown) => {
            lastCreateParams = params;
            return createImpl(params);
          },
          delete: (assetId: string) => deleteImpl(assetId),
        },
      };
    },
  };
});

describe("createMuxClip", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("MUX_TOKEN_ID", "test-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
    lastCreateParams = undefined;
  });

  it("creates a public basic-quality asset clipped from the source (mux://assets/…)", async () => {
    createImpl = () =>
      Promise.resolve({
        id: "clip_asset_1",
        playback_ids: [{ id: "pb_clip", policy: "public" }],
      });
    const { createMuxClip } = await import("../mux");
    const result = await createMuxClip("src_asset_9", 65, 95);
    expect(lastCreateParams).toEqual({
      inputs: [
        { url: "mux://assets/src_asset_9", start_time: 65, end_time: 95 },
      ],
      playback_policies: ["public"],
      video_quality: "basic",
    });
    expect(result).toEqual({ assetId: "clip_asset_1", playbackId: "pb_clip" });
  });

  it("returns a null playbackId when Mux hasn't attached a public one", async () => {
    createImpl = () =>
      Promise.resolve({
        id: "clip_asset_1",
        playback_ids: [{ id: "pb_signed", policy: "signed" }],
      });
    const { createMuxClip } = await import("../mux");
    const result = await createMuxClip("src_asset_9", 0, 30);
    expect(result).toEqual({ assetId: "clip_asset_1", playbackId: null });
  });

  it("throws mux_clip_incomplete when the created asset has no id", async () => {
    createImpl = () => Promise.resolve({});
    const { createMuxClip } = await import("../mux");
    await expect(createMuxClip("src_asset_9", 0, 30)).rejects.toThrow(
      "mux_clip_incomplete",
    );
  });
});

describe("deleteMuxAsset", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("MUX_TOKEN_ID", "test-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
  });

  it("deletes the asset", async () => {
    const seen: string[] = [];
    deleteImpl = (assetId) => {
      seen.push(assetId);
      return Promise.resolve();
    };
    const { deleteMuxAsset } = await import("../mux");
    await deleteMuxAsset("clip_asset_1");
    expect(seen).toEqual(["clip_asset_1"]);
  });

  it("swallows Mux 404s so a double-delete converges", async () => {
    deleteImpl = () =>
      Promise.reject(Object.assign(new Error("not found"), { status: 404 }));
    const { deleteMuxAsset } = await import("../mux");
    await expect(deleteMuxAsset("clip_asset_1")).resolves.toBeUndefined();
  });

  it("rethrows non-404 errors", async () => {
    deleteImpl = () =>
      Promise.reject(Object.assign(new Error("boom"), { status: 500 }));
    const { deleteMuxAsset } = await import("../mux");
    await expect(deleteMuxAsset("clip_asset_1")).rejects.toThrow("boom");
  });
});

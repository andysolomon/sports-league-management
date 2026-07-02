import { describe, it, expect, vi, beforeEach } from "vitest";

// mux.ts is `import "server-only"`; neutralize that guard for the test runner.
vi.mock("server-only", () => ({}));

// Mock the Mux SDK so we can drive liveStreams.create's outcome without a
// real account. The mock's create() reads from `createImpl`, set per test,
// and records its params so tests can assert the creation payload.
let createImpl: () => Promise<unknown>;
let lastCreateParams: Record<string, unknown> | undefined;
vi.mock("@mux/mux-node", () => {
  return {
    default: class MockMux {
      video = {
        liveStreams: {
          create: (params: Record<string, unknown>) => {
            lastCreateParams = params;
            return createImpl();
          },
        },
      };
    },
  };
});

describe("createMuxLiveStream", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("MUX_TOKEN_ID", "test-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
    lastCreateParams = undefined;
  });

  it("maps Mux's free-plan rejection to a clean mux_plan_required error", async () => {
    createImpl = () =>
      Promise.reject(
        new Error(
          '400 {"error":{"type":"invalid_parameters","messages":["Live streams are unavailable on the free plan"]}}',
        ),
      );
    const { createMuxLiveStream } = await import("../mux");
    await expect(createMuxLiveStream(180)).rejects.toThrow("mux_plan_required");
  });

  it("rethrows unrelated Mux errors unchanged", async () => {
    createImpl = () => Promise.reject(new Error("503 service unavailable"));
    const { createMuxLiveStream } = await import("../mux");
    await expect(createMuxLiveStream(180)).rejects.toThrow(
      "503 service unavailable",
    );
  });

  it("returns stream details on success", async () => {
    createImpl = () =>
      Promise.resolve({
        id: "ls_123",
        stream_key: "sk_abc",
        playback_ids: [{ id: "pb_xyz" }],
      });
    const { createMuxLiveStream } = await import("../mux");
    const result = await createMuxLiveStream(180);
    expect(result).toEqual({
      liveStreamId: "ls_123",
      streamKey: "sk_abc",
      playbackId: "pb_xyz",
      rtmpUrl: "rtmps://global-live.mux.com:443/app",
    });
  });

  // WSM-000200 (#303 track 2): latency mode is pinned explicitly at creation.
  it("creates in standard latency mode by default", async () => {
    createImpl = () =>
      Promise.resolve({
        id: "ls_123",
        stream_key: "sk_abc",
        playback_ids: [{ id: "pb_xyz" }],
      });
    const { createMuxLiveStream } = await import("../mux");
    await createMuxLiveStream(180);
    expect(lastCreateParams?.latency_mode).toBe("standard");
  });

  it("creates in low latency (LL-HLS) mode when opted in", async () => {
    createImpl = () =>
      Promise.resolve({
        id: "ls_123",
        stream_key: "sk_abc",
        playback_ids: [{ id: "pb_xyz" }],
      });
    const { createMuxLiveStream } = await import("../mux");
    await createMuxLiveStream(180, { lowLatency: true });
    expect(lastCreateParams?.latency_mode).toBe("low");
    // The rest of the payload is unchanged by the latency opt-in.
    expect(lastCreateParams?.max_continuous_duration).toBe(180 * 60);
    expect(lastCreateParams?.playback_policy).toEqual(["public"]);
  });
});

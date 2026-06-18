import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Controllable mock of ConvexHttpClient: `h.has` toggles whether the client
// exposes setAdminAuth; `h.setAdminAuth` captures the call.
const h = vi.hoisted(() => ({ has: true, setAdminAuth: vi.fn() }));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    url: string;
    setAdminAuth?: (key: string) => void;
    constructor(url: string) {
      this.url = url;
      if (h.has) this.setAdminAuth = h.setAdminAuth;
    }
  },
}));

import { getConvexClient } from "../convex-client";

const ORIG_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const ORIG_KEY = process.env.CONVEX_ADMIN_KEY;

beforeEach(() => {
  h.has = true;
  h.setAdminAuth.mockClear();
});
afterEach(() => {
  if (ORIG_URL === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL;
  else process.env.NEXT_PUBLIC_CONVEX_URL = ORIG_URL;
  if (ORIG_KEY === undefined) delete process.env.CONVEX_ADMIN_KEY;
  else process.env.CONVEX_ADMIN_KEY = ORIG_KEY;
});

describe("getConvexClient", () => {
  it("applies admin auth when the key is set and setAdminAuth exists", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://prod.convex.cloud";
    process.env.CONVEX_ADMIN_KEY = "prod:x|abc";
    getConvexClient();
    expect(h.setAdminAuth).toHaveBeenCalledWith("prod:x|abc");
  });

  it("throws (no silent non-admin client) when key is set but setAdminAuth is missing", () => {
    h.has = false;
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://prod.convex.cloud";
    process.env.CONVEX_ADMIN_KEY = "prod:x|abc";
    expect(() => getConvexClient()).toThrow(/setAdminAuth/);
  });

  it("throws when no admin key on a non-local deployment", () => {
    delete process.env.CONVEX_ADMIN_KEY;
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://prod.convex.cloud";
    expect(() => getConvexClient()).toThrow(/Missing Convex admin key/);
  });

  it("allows a local deployment with no admin key", () => {
    delete process.env.CONVEX_ADMIN_KEY;
    process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:3210";
    expect(() => getConvexClient()).not.toThrow();
  });

  it("throws when the Convex URL is missing", () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    process.env.CONVEX_ADMIN_KEY = "prod:x|abc";
    expect(() => getConvexClient()).toThrow(/Convex deployment URL/);
  });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { assertClerkKeysForEnv, runClerkEnvGuard } from "../clerk-env-guard";

/*
 * Regression guard for WSM-000168 (production ran Clerk DEVELOPMENT keys).
 *
 * Encodes the ticket's acceptance criteria: a production build MUST fail when a
 * `pk_test_`/`sk_test_` key is present, and MUST pass with `pk_live_`/`sk_live_`.
 * Preview/local builds legitimately use development keys and must not throw.
 */

describe("assertClerkKeysForEnv (WSM-000168)", () => {
  it("throws when a development publishable key is used in production", () => {
    expect(() =>
      assertClerkKeysForEnv({
        vercelEnv: "production",
        publishableKey: "pk_test_ZXhhbXBsZQ",
        secretKey: "sk_live_realproduction",
      }),
    ).toThrow(/WSM-000168/);
  });

  it("throws when a development secret key is used in production", () => {
    expect(() =>
      assertClerkKeysForEnv({
        vercelEnv: "production",
        publishableKey: "pk_live_realproduction",
        secretKey: "sk_test_ZXhhbXBsZQ",
      }),
    ).toThrow(/DEVELOPMENT/);
  });

  it("passes when production uses live keys", () => {
    expect(() =>
      assertClerkKeysForEnv({
        vercelEnv: "production",
        publishableKey: "pk_live_realproduction",
        secretKey: "sk_live_realproduction",
      }),
    ).not.toThrow();
  });

  it("allows development keys on preview deployments", () => {
    expect(() =>
      assertClerkKeysForEnv({
        vercelEnv: "preview",
        publishableKey: "pk_test_ZXhhbXBsZQ",
        secretKey: "sk_test_ZXhhbXBsZQ",
      }),
    ).not.toThrow();
  });

  it("allows development keys locally (VERCEL_ENV undefined)", () => {
    expect(() =>
      assertClerkKeysForEnv({
        vercelEnv: undefined,
        publishableKey: "pk_test_ZXhhbXBsZQ",
        secretKey: "sk_test_ZXhhbXBsZQ",
      }),
    ).not.toThrow();
  });

  it("does not leak the raw key value in the error message", () => {
    let message = "";
    try {
      assertClerkKeysForEnv({
        vercelEnv: "production",
        publishableKey: "pk_test_SUPERSECRETVALUE123",
        secretKey: undefined,
      });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toContain("SUPERSECRETVALUE123");
    expect(message).toContain("pk_test_");
  });
});

describe("runClerkEnvGuard (reads process.env)", () => {
  const original = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.VERCEL_ENV = original.VERCEL_ENV;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      original.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    process.env.CLERK_SECRET_KEY = original.CLERK_SECRET_KEY;
  });

  it("throws for a dev publishable key when VERCEL_ENV=production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_ZXhhbXBsZQ");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_ZXhhbXBsZQ");
    expect(() => runClerkEnvGuard()).toThrow(/WSM-000168/);
  });

  it("is a no-op for a live key in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_realproduction");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_live_realproduction");
    expect(() => runClerkEnvGuard()).not.toThrow();
  });
});

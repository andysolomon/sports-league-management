/*
 * Production Clerk-key guard (WSM-000168).
 *
 * Clerk development instances have strict rate limits and a hard user cap and
 * must never serve production traffic — but a `pk_test_`/`sk_test_` key set in
 * Vercel Production only surfaces as a console warning + a "Development mode"
 * badge, which shipped silently once already. This guard turns that silent
 * misconfig into a hard failure.
 *
 * It runs at BUILD time (from `next.config.ts`), not boot time, on purpose: a
 * failed build is never promoted, so Vercel keeps the previous good deployment
 * serving instead of booting a broken one. Only fires when `VERCEL_ENV` is
 * "production" — preview and local builds legitimately use development keys.
 *
 * Never logs a key value; only the `pk_test_`/`sk_test_` prefix is named.
 */

export interface ClerkKeyEnv {
  /** Vercel's deployment environment: "production" | "preview" | "development" | undefined (local). */
  vercelEnv: string | undefined;
  /** NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_test_… on a dev instance, pk_live_… on prod). */
  publishableKey: string | undefined;
  /** CLERK_SECRET_KEY (sk_test_… on a dev instance, sk_live_… on prod). */
  secretKey: string | undefined;
}

/**
 * Throws if a Clerk **development** key is configured while `vercelEnv` is
 * "production". Pure (no `process.env` access) so it is trivially testable.
 */
export function assertClerkKeysForEnv(env: ClerkKeyEnv): void {
  if (env.vercelEnv !== "production") return;

  const devKey = env.publishableKey?.startsWith("pk_test_")
    ? "publishable (pk_test_…)"
    : env.secretKey?.startsWith("sk_test_")
      ? "secret (sk_test_…)"
      : null;

  if (devKey) {
    throw new Error(
      `[WSM-000168] Refusing to build for production: the Clerk ${devKey} key is a ` +
        `DEVELOPMENT key but VERCEL_ENV=production. Clerk development instances have ` +
        `strict rate limits and a hard user cap and must not serve production traffic. ` +
        `Set production keys (pk_live_/sk_live_) in Vercel Production and redeploy. ` +
        `See https://github.com/andysolomon/sports-league-management/issues/386`,
    );
  }
}

/** Reads the process environment and applies {@link assertClerkKeysForEnv}. */
export function runClerkEnvGuard(): void {
  assertClerkKeysForEnv({
    vercelEnv: process.env.VERCEL_ENV,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });
}

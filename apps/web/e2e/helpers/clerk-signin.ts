/**
 * Clerk sign-in helper for Playwright e2e specs.
 *
 * `setupClerkTestingToken` from @clerk/testing only injects the bot-bypass
 * token — it does not authenticate a user. For specs that hit auth-gated
 * routes (anything under `/dashboard`), call `signInTestUser(page)` after
 * `setupClerkTestingToken({ page })` in `beforeEach`.
 *
 * The flow: mint a one-shot Clerk sign-in token via the Backend API
 * (https://clerk.com/docs/reference/backend-api/tag/Sign-in-Tokens), then
 * pass it to `clerk.signIn` with `strategy: "ticket"`. This works for users
 * with no password (e.g. Google OAuth-only accounts) and is the documented
 * automation path.
 *
 * Required env (all already present when CONVEX_ENABLE_E2E_SEED is set up):
 *   - CLERK_SECRET_KEY    — backend secret for the dev Clerk instance
 *   - E2E_CLERK_USER_ID   — the user_… ID to impersonate
 *
 * Prod sweep overrides (live Clerk instance after #386 cutover):
 *   - PROD_CLERK_SECRET_KEY    — falls back to CLERK_SECRET_KEY
 *   - PROD_E2E_CLERK_USER_ID   — falls back to E2E_CLERK_USER_ID
 */
import type { Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const SIGN_IN_TOKENS_ENDPOINT = "https://api.clerk.com/v1/sign_in_tokens";

interface SignInTokenResponse {
  token: string;
  status: string;
}

async function mintSignInToken(
  userId: string,
  secret: string,
): Promise<string> {
  const res = await fetch(SIGN_IN_TOKENS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[clerk-signin] sign_in_tokens failed: ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as SignInTokenResponse;
  return json.token;
}

export interface SignInOptions {
  /**
   * Which test user to impersonate. Defaults to the primary user (E2E_CLERK_USER_ID).
   * Pass "B" to sign in as the secondary user (E2E_CLERK_USER_ID_B) — used for
   * cross-org isolation specs where the test needs a user who is NOT a member
   * of the fixture league's org.
   */
  userVariant?: "A" | "B";
}

function resolveUserId(variant: "A" | "B"): string | undefined {
  if (variant === "B") {
    return process.env.E2E_CLERK_USER_ID_B;
  }
  return process.env.PROD_E2E_CLERK_USER_ID ?? process.env.E2E_CLERK_USER_ID;
}

function resolveClerkSecret(): string | undefined {
  return process.env.PROD_CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY;
}

export async function signInTestUser(
  page: Page,
  options: SignInOptions = {},
): Promise<void> {
  const variant = options.userVariant ?? "A";
  const userId = resolveUserId(variant);
  const secret = resolveClerkSecret();
  if (!userId) {
    const envName =
      variant === "B"
        ? "E2E_CLERK_USER_ID_B"
        : "PROD_E2E_CLERK_USER_ID or E2E_CLERK_USER_ID";
    throw new Error(
      `[clerk-signin] ${envName} is required to sign in the e2e test user.`,
    );
  }
  if (!secret) {
    throw new Error(
      "[clerk-signin] PROD_CLERK_SECRET_KEY or CLERK_SECRET_KEY is required to mint a sign-in token.",
    );
  }

  const ticket = await mintSignInToken(userId, secret);
  await page.goto("/");
  await clerk.signIn({
    page,
    signInParams: { strategy: "ticket", ticket },
  });
}

/**
 * Canonical fixture harness — Playwright side (WSM-000187).
 *
 * Wraps the Convex `e2eSeed:createCanonicalFixture` mutation, which seeds the
 * fixed NFL/MLS dataset (4 teams, 12 players, 3 seasons, 1 division) the
 * data-dependent specs assert on into a single league owned by the test org.
 *
 * The fixture is seeded ONCE in global-setup and its `leagueId` is written to a
 * gitignored file; each data-dependent spec reads it and sets the
 * `activeLeagueId` cookie (via `setActiveLeague`) so the active-league-scoped
 * pages (teams/players/divisions/leagues) render exactly this league's data.
 *
 * Runtime prerequisites (same as seed-roster):
 *   - `CONVEX_ENABLE_E2E_SEED=1` on the target Convex deployment
 *   - `NEXT_PUBLIC_CONVEX_URL` + (remote) `CONVEX_ADMIN_KEY` in the runner env
 *   - `E2E_CLERK_ORG_ID` so the league is owned by the test user's org
 */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

// Mirrors apps/web/src/lib/active-league-cookie.ts (ACTIVE_LEAGUE_COOKIE). The
// switcher writes the raw league id here; SSR reads it to scope queries.
const ACTIVE_LEAGUE_COOKIE = "activeLeagueId";

// Resolved from the package cwd (apps/web) — the suite always runs from there.
const FIXTURE_FILE = path.resolve("e2e", ".canonical-fixture.json");

export interface CanonicalFixture {
  leagueId: string;
  leagueName: string;
  divisionId: string;
  teamIds: string[];
  seasonIds: string[];
  playerIds: string[];
}

const createCanonicalRef = makeFunctionReference<
  "mutation",
  { clerkOrgId: string | null },
  CanonicalFixture
>("e2eSeed:createCanonicalFixture");

const resetCanonicalRef = makeFunctionReference<
  "mutation",
  { clerkOrgId: string | null },
  { deleted: number }
>("e2eSeed:resetCanonicalFixture");

function getSeedClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminKey = process.env.CONVEX_ADMIN_KEY;
  if (!url) {
    throw new Error(
      "[seed-canonical] NEXT_PUBLIC_CONVEX_URL is required to run the e2e seed harness.",
    );
  }
  const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
  if (!adminKey && !isLocal) {
    throw new Error(
      "[seed-canonical] CONVEX_ADMIN_KEY is required for non-local deployments.",
    );
  }
  const client = new ConvexHttpClient(url);
  if (adminKey) {
    (
      client as ConvexHttpClient & { setAdminAuth?: (key: string) => void }
    ).setAdminAuth?.(adminKey);
  }
  return client;
}

export async function seedCanonicalFixture(
  clerkOrgId: string | null,
): Promise<CanonicalFixture> {
  const client = getSeedClient();
  let fixture: CanonicalFixture;
  try {
    fixture = await client.mutation(createCanonicalRef, { clerkOrgId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("e2e_seed_disabled")) {
      throw new Error(
        "[seed-canonical] Convex rejected the seed mutation — set CONVEX_ENABLE_E2E_SEED=1 on the target deployment.",
      );
    }
    throw err;
  }
  fs.writeFileSync(FIXTURE_FILE, JSON.stringify(fixture), "utf8");
  return fixture;
}

export async function resetCanonicalFixture(
  clerkOrgId: string | null,
): Promise<{ deleted: number }> {
  const client = getSeedClient();
  return client.mutation(resetCanonicalRef, { clerkOrgId });
}

/** Reads the fixture written by global-setup. Throws if seeding didn't run. */
export function readCanonicalFixture(): CanonicalFixture {
  if (!fs.existsSync(FIXTURE_FILE)) {
    throw new Error(
      "[seed-canonical] .canonical-fixture.json not found — global-setup did not seed the canonical fixture.",
    );
  }
  return JSON.parse(fs.readFileSync(FIXTURE_FILE, "utf8")) as CanonicalFixture;
}

/**
 * Sets the active-league cookie so the active-league-scoped dashboard pages
 * render the given league. Call in `beforeEach` AFTER signing in and BEFORE
 * navigating to a `/dashboard/*` route (the cookie is read server-side on SSR).
 */
export async function setActiveLeague(
  page: Page,
  leagueId: string,
): Promise<void> {
  await page.context().addCookies([
    { name: ACTIVE_LEAGUE_COOKIE, value: leagueId, domain: "localhost", path: "/" },
  ]);
}

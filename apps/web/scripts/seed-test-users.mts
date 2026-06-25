/**
 * Test users + roles seed (WSM-000171).
 *
 * Stands up a self-contained test org with one user per app role so you can
 * sign in and exercise role-gated UI and the members flow:
 *   - admin  → Clerk `org:admin`            (full control)
 *   - coach  → Clerk `org:member` + Convex `orgMemberRoles` row "coach"
 *   - viewer → Clerk `org:member`, no row   (read-only default)
 *   - viewer2 → a second viewer, so the Members list isn't a single row
 * plus a populated "Sports League — Test League" owned by the org (a couple of
 * teams) to give the roles something to act on.
 *
 * Identity is Clerk (the app has no users table). Users are created via the
 * Clerk Backend API with a known password; Backend-created emails are
 * auto-verified, so they sign in with email + password immediately — on the
 * dev AND live instances (no inbox needed). Emails use the `+clerk_test`
 * convention so they're unmistakably test accounts (and get dev test-mode).
 *
 * Idempotent: users (by email), org (by name), membership, the coach role row,
 * the league (upsert by name) and teams are all find-or-create. Re-run freely.
 *
 * PREREQUISITE: the target Clerk instance must allow password sign-in
 * (Dashboard → User & Authentication → Email/Password). If only email-code is
 * enabled, the accounts exist but can't password-login.
 *
 * Usage (dry-run prints the plan; --write applies it):
 *   CLERK_SECRET_KEY=sk_...  NEXT_PUBLIC_CONVEX_URL=https://....convex.cloud \
 *   CONVEX_ADMIN_KEY=...  npx tsx apps/web/scripts/seed-test-users.mts [--write]
 *
 * The Clerk instance (dev vs live) is whichever CLERK_SECRET_KEY you pass.
 */
import { createClerkClient } from "@clerk/backend";
import { ConvexHttpClient } from "convex/browser";

const WRITE = process.argv.includes("--write");

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const CONVEX_ADMIN_KEY = process.env.CONVEX_ADMIN_KEY;

if (!CLERK_SECRET_KEY) {
  console.error("CLERK_SECRET_KEY is required (its sk_test_/sk_live_ prefix picks the instance).");
  process.exit(1);
}
if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is required (the target Convex deployment).");
  process.exit(1);
}

const IS_LIVE = CLERK_SECRET_KEY.startsWith("sk_live_");
const INSTANCE = IS_LIVE ? "LIVE (production)" : "test (dev)";
// Dev and live share one Convex deployment, and upsertLeague keys on name only,
// so the org + league names are tagged per instance to avoid cross-run
// collisions (Clerk orgs are per-instance, but the Convex league is shared).
const TAG = IS_LIVE ? "live" : "dev";

const ORG_NAME = `Sports League — Test Org (${TAG})`;
const LEAGUE_NAME = `Sports League — Test League (${TAG})`;
// A known, shared password for all test accounts. Test-only; not a secret.
const PASSWORD = "SprtsmngTest!2026";

type AppRole = "admin" | "coach" | "viewer";
interface TestUser {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
}

const USERS: TestUser[] = [
  { key: "admin", email: "admin+clerk_test@example.com", firstName: "Ada", lastName: "Admin", role: "admin" },
  { key: "coach", email: "coach+clerk_test@example.com", firstName: "Cory", lastName: "Coach", role: "coach" },
  { key: "viewer", email: "viewer+clerk_test@example.com", firstName: "Val", lastName: "Viewer", role: "viewer" },
  { key: "viewer2", email: "viewer2+clerk_test@example.com", firstName: "Vic", lastName: "Viewer", role: "viewer" },
];

const TEAMS = [
  { name: "Test Eagles", city: "Marietta" },
  { name: "Test Hawks", city: "Acworth" },
];

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

async function findUserByEmail(email: string): Promise<string | null> {
  const res = await clerk.users.getUserList({ emailAddress: [email] });
  return res.data[0]?.id ?? null;
}

async function ensureUser(u: TestUser): Promise<string> {
  const existing = await findUserByEmail(u.email);
  if (existing) {
    console.log(`  user exists: ${u.email} (${existing})`);
    return existing;
  }
  if (!WRITE) {
    console.log(`  [dry-run] would create user: ${u.email}`);
    return `dry_${u.key}`;
  }
  const created = await clerk.users.createUser({
    emailAddress: [u.email],
    password: PASSWORD,
    firstName: u.firstName,
    lastName: u.lastName,
    skipPasswordChecks: true,
  });
  console.log(`  user CREATED: ${u.email} (${created.id})`);
  return created.id;
}

async function ensureOrg(adminUserId: string): Promise<string> {
  const list = await clerk.organizations.getOrganizationList({ limit: 100 });
  const found = list.data.find((o) => o.name === ORG_NAME);
  if (found) {
    console.log(`  org exists: ${ORG_NAME} (${found.id})`);
    return found.id;
  }
  if (!WRITE) {
    console.log(`  [dry-run] would create org: ${ORG_NAME} (createdBy admin)`);
    return "dry_org";
  }
  const org = await clerk.organizations.createOrganization({ name: ORG_NAME, createdBy: adminUserId });
  console.log(`  org CREATED: ${ORG_NAME} (${org.id})`);
  return org.id;
}

async function ensureMembership(orgId: string, userId: string, clerkRole: string): Promise<void> {
  if (!WRITE) {
    console.log(`  [dry-run] would ensure membership ${userId} → ${clerkRole}`);
    return;
  }
  const members = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 });
  const isMember = members.data.some((m) => m.publicUserData?.userId === userId);
  if (isMember) {
    console.log(`  membership exists: ${userId} (${clerkRole})`);
    return;
  }
  try {
    await clerk.organizations.createOrganizationMembership({ organizationId: orgId, userId, role: clerkRole });
    console.log(`  membership CREATED: ${userId} → ${clerkRole}`);
  } catch (e) {
    // The admin is already a member via createdBy; ignore "already a member".
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  membership skipped for ${userId}: ${msg}`);
  }
}

async function main() {
  console.log(`\nTest-user seed — ${WRITE ? "WRITE" : "DRY RUN"}`);
  console.log(`  Clerk instance: ${INSTANCE}`);
  console.log(`  Convex: ${CONVEX_URL}`);
  console.log(`  Org "${ORG_NAME}" · League "${LEAGUE_NAME}" · ${USERS.length} users\n`);

  // 1) Users (admin first — it becomes the org creator/admin).
  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.key] = await ensureUser(u);

  // 2) Org (createdBy admin → admin is org:admin).
  const orgId = await ensureOrg(ids["admin"]);

  // 3) Memberships: admin already admin via createdBy; coach/viewer = org:member.
  for (const u of USERS) {
    if (u.role === "admin") continue;
    await ensureMembership(orgId, ids[u.key], "org:member");
  }

  // 4) Convex-side: coach sub-role row; viewers stay default (no row); + league/teams.
  if (WRITE) {
    if (!CONVEX_ADMIN_KEY) {
      throw new Error("CONVEX_ADMIN_KEY is required to write the coach role + test league (internal mutations, WSM-000096).");
    }
    const convex = new ConvexHttpClient(CONVEX_URL!);
    (convex as unknown as { setAdminAuth: (k: string) => void }).setAdminAuth(CONVEX_ADMIN_KEY);
    const m = (name: string, args: unknown) => convex.mutation(name as never, args as never) as Promise<unknown>;

    for (const u of USERS) {
      if (u.role === "coach") {
        await m("sports:setOrgMemberRole", { orgId, userId: ids[u.key], role: "coach" });
        console.log(`  convex orgMemberRole set: ${u.email} → coach`);
      }
    }

    const league = (await m("sports:upsertLeague", { name: LEAGUE_NAME, orgId })) as {
      dto: { id: string };
      created: boolean;
    };
    const leagueId = league.dto.id;
    console.log(`  league ${league.created ? "CREATED" : "exists"}: ${LEAGUE_NAME} (${leagueId})`);

    let teamsNew = 0;
    for (const t of TEAMS) {
      const res = (await m("sports:upsertTeam", {
        name: t.name,
        city: t.city,
        stadium: "",
        leagueId,
        divisionId: null,
        logoUrl: null,
      })) as { created: boolean };
      if (res.created) teamsNew += 1;
    }
    console.log(`  ${TEAMS.length} teams upserted (${teamsNew} new)`);
  }

  // 5) Summary.
  console.log(`\n${WRITE ? "✔ Seeded" : "DRY RUN — pass --write to seed"}. Test accounts (password for all: ${PASSWORD}):`);
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(6)}  ${u.email}`);
  }
  if (WRITE) {
    console.log(`\nSign in at the app's /sign-in with the email + password above.`);
    console.log(`Org: ${ORG_NAME} (${orgId}).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Cobb County GHSA football seed (WSM-000104).
 *
 * Stands up a PUBLIC "Cobb County Football" league seeded with the 16 Cobb
 * County School District high schools as teams, grouped into divisions by GHSA
 * classification (2024-26 cycle). Rosters are intentionally empty — they're
 * filled by coaches (the app's core purpose); GHSA/MaxPreps roster data is not
 * scraped. Once seeded, coaches discover and import the league (à la carte).
 *
 * Idempotent: upsert-by-name for the league, divisions, and teams, so re-runs
 * don't duplicate. Dry-run by default; pass --write.
 *
 * Usage:
 *   NEXT_PUBLIC_CONVEX_URL=<url> npx tsx apps/web/scripts/seed-ghsa-cobb.mts [--write]
 *
 * Source: GHSA 2024-26 region/classification placements (public).
 */
import { ConvexHttpClient } from "convex/browser";

const WRITE = process.argv.includes("--write");
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is required (point it at the target deployment).");
  process.exit(1);
}

const LEAGUE_NAME = "Cobb County Football";

// The 16 Cobb County School District high schools, 2024-26 GHSA classification.
const SCHOOLS: { name: string; city: string; cls: "6A" | "5A" | "4A" }[] = [
  { name: "Allatoona", city: "Acworth", cls: "4A" },
  { name: "Campbell", city: "Smyrna", cls: "6A" },
  { name: "Harrison", city: "Kennesaw", cls: "6A" },
  { name: "Hillgrove", city: "Powder Springs", cls: "6A" },
  { name: "Kell", city: "Marietta", cls: "4A" },
  { name: "Kennesaw Mountain", city: "Kennesaw", cls: "6A" },
  { name: "Lassiter", city: "Marietta", cls: "5A" },
  { name: "McEachern", city: "Powder Springs", cls: "6A" },
  { name: "North Cobb", city: "Kennesaw", cls: "6A" },
  { name: "Osborne", city: "Marietta", cls: "6A" },
  { name: "Pebblebrook", city: "Mableton", cls: "6A" },
  { name: "Pope", city: "Marietta", cls: "5A" },
  { name: "South Cobb", city: "Austell", cls: "6A" },
  { name: "Sprayberry", city: "Marietta", cls: "5A" },
  { name: "Walton", city: "Marietta", cls: "6A" },
  { name: "Wheeler", city: "Marietta", cls: "6A" },
];

const DIVISION_NAME = (cls: string) => `Class ${cls}`;

async function main() {
  console.log(`GHSA Cobb seed — ${WRITE ? "WRITE" : "DRY RUN"}, deployment ${CONVEX_URL}`);
  const classes = Array.from(new Set(SCHOOLS.map((s) => s.cls)));
  console.log(`  league "${LEAGUE_NAME}" · ${classes.length} divisions · ${SCHOOLS.length} schools`);
  for (const cls of classes) {
    const names = SCHOOLS.filter((s) => s.cls === cls).map((s) => s.name);
    console.log(`  ${DIVISION_NAME(cls)}: ${names.join(", ")}`);
  }

  if (!WRITE) {
    console.log("DRY RUN — pass --write to seed. Nothing written.");
    return;
  }

  const client = new ConvexHttpClient(CONVEX_URL!);
  const adminKey = process.env.CONVEX_ADMIN_KEY;
  if (adminKey) {
    (client as unknown as { setAdminAuth: (k: string) => void }).setAdminAuth(adminKey);
  }
  const m = (name: string, args: unknown) =>
    client.mutation(name as never, args as never) as Promise<unknown>;

  const league = (await m("sports:upsertLeague", {
    name: LEAGUE_NAME,
    orgId: null,
  })) as { dto: { id: string }; created: boolean };
  const leagueId = league.dto.id;
  console.log(`  league ${league.created ? "created" : "exists"}: ${leagueId}`);

  await m("sports:setLeaguePublic", { leagueId, isPublic: true });
  console.log("  league set public");

  const divisionByClass = new Map<string, string>();
  for (const cls of classes) {
    const div = (await m("sports:upsertDivision", {
      name: DIVISION_NAME(cls),
      leagueId,
    })) as { dto: { id: string }; created: boolean };
    divisionByClass.set(cls, div.dto.id);
    console.log(`  division ${div.created ? "created" : "exists"}: ${DIVISION_NAME(cls)}`);
  }

  let created = 0;
  for (const school of SCHOOLS) {
    const res = (await m("sports:upsertTeam", {
      name: school.name,
      city: school.city,
      stadium: "",
      leagueId,
      divisionId: divisionByClass.get(school.cls) ?? null,
      logoUrl: null,
    })) as { created: boolean };
    if (res.created) created += 1;
  }
  console.log(`Done — ${SCHOOLS.length} teams upserted (${created} new).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * GHSA school/region seed importer (PROTOTYPE).
 *
 * Reads a GHSA alignment file (Classification -> Region -> School) and emits a
 * LeagueImportPayload that the EXISTING import pipeline already understands:
 *
 *     POST /api/cli/import   (validated against LeagueImportSchema)
 *
 * Mapping decision — the import contract is flat (League -> Division -> Team),
 * but GHSA has two levels above the team (Classification -> Region -> School).
 * We flatten the top two into the division name, e.g. "Region 1-6A", so the
 * region structure survives without changing the contract.
 *
 * Teams are seeded EMPTY (no players). `city`/`stadium` are required by the
 * schema, so any school missing a city gets a "TBD" placeholder a coach fixes
 * when they claim the team. No players are scraped from anyone.
 *
 * Zero dependencies — runs on plain `node` (>=18, uses global fetch).
 *
 * Usage:
 *   node scripts/ghsa-seed/build-import.mjs
 *   node scripts/ghsa-seed/build-import.mjs --in scripts/ghsa-seed/data/ghsa-2024-26.json --out out/ghsa-import.json
 *   node scripts/ghsa-seed/build-import.mjs --post http://localhost:3000 --key sk_live_xxx
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER = "TBD"; // city/stadium filled by coach on claim

// --- tiny arg parser -------------------------------------------------------
function parseArgs(argv) {
  const args = {
    in: resolve(HERE, "data/ghsa-2024-26.json"),
    out: resolve(HERE, "out/ghsa-import.json"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") args.in = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--post") args.post = argv[++i];
    else if (a === "--key") args.key = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

// --- transform: alignment -> LeagueImportPayload ---------------------------
function buildPayload(alignment) {
  const warnings = [];
  const divisions = [];
  let teamCount = 0;
  let placeholderCities = 0;

  for (const cls of alignment.classifications ?? []) {
    for (const region of cls.regions ?? []) {
      const divisionName = `Region ${region.region}-${cls.name}`;
      const teams = (region.schools ?? []).map((school) => {
        const city = (school.city ?? "").trim();
        if (!city) placeholderCities++;
        teamCount++;
        return {
          name: school.name,
          city: city || PLACEHOLDER,
          stadium: (school.stadium ?? "").trim() || PLACEHOLDER,
          players: [],
        };
      });
      if (teams.length === 0) {
        warnings.push(`Skipped empty division "${divisionName}" (no schools).`);
        continue;
      }
      divisions.push({ name: divisionName, teams });
    }
  }

  const payload = { league: { name: alignment.league }, divisions };
  return { payload, stats: { divisions: divisions.length, teamCount, placeholderCities }, warnings };
}

// --- validation: mirror LeagueImportSchema (api-contracts) ------------------
// Kept structural + dependency-free; the server re-validates with the real zod
// schema on POST, which remains the source of truth.
function validate(payload) {
  const errors = [];
  const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

  if (!payload.league || !nonEmpty(payload.league.name)) {
    errors.push("league.name is required.");
  }
  if (!Array.isArray(payload.divisions) || payload.divisions.length === 0) {
    errors.push("At least one division is required.");
  }
  (payload.divisions ?? []).forEach((d, di) => {
    if (!nonEmpty(d.name)) errors.push(`divisions[${di}].name is required.`);
    if (!Array.isArray(d.teams) || d.teams.length === 0) {
      errors.push(`divisions[${di}] ("${d.name}") must have at least one team.`);
    }
    (d.teams ?? []).forEach((t, ti) => {
      const at = `divisions[${di}].teams[${ti}]`;
      if (!nonEmpty(t.name)) errors.push(`${at}.name is required.`);
      if (!nonEmpty(t.city)) errors.push(`${at}.city is required.`);
      if (!nonEmpty(t.stadium)) errors.push(`${at}.stadium is required.`);
    });
  });
  return errors;
}

async function post(baseUrl, key, payload) {
  if (!key) throw new Error("--post requires --key <clerk_api_key>.");
  const url = `${baseUrl.replace(/\/$/, "")}/api/cli/import`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

// --- main ------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      [
        "GHSA seed importer (prototype)",
        "",
        "  --in <path>    alignment JSON      (default scripts/ghsa-seed/data/ghsa-2024-26.json)",
        "  --out <path>   write payload JSON  (default out/ghsa-import.json)",
        "  --post <url>   POST to <url>/api/cli/import (requires --key)",
        "  --key <key>    Clerk API key for --post",
      ].join("\n"),
    );
    return;
  }

  const inPath = resolve(HERE, args.in);
  const outPath = resolve(HERE, args.out);

  const alignment = JSON.parse(await readFile(inPath, "utf8"));
  const { payload, stats, warnings } = buildPayload(alignment);

  const errors = validate(payload);
  if (errors.length > 0) {
    console.error("Validation FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`GHSA seed: ${payload.league.name}`);
  console.log(
    `  ${stats.divisions} regions  ${stats.teamCount} schools  ` +
      `${stats.placeholderCities} with placeholder city ("${PLACEHOLDER}")`,
  );
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log(`  wrote ${outPath}`);

  if (args.post) {
    console.log(`\nPOST ${args.post}/api/cli/import ...`);
    const r = await post(args.post, args.key, payload);
    console.log(`  -> ${r.status}`);
    console.log(typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2));
    if (!r.ok) process.exit(1);
  } else {
    console.log(
      "\nDry run (no --post). Review the file, then import via the dashboard\n" +
        "  /dashboard/import  (upload the JSON), or re-run with:\n" +
        "  --post <baseUrl> --key <clerkApiKey>",
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

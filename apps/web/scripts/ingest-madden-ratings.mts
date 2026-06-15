/**
 * Madden ratings ingest (WSM-000095).
 *
 * Pulls the Madden NFL ratings straight from a link-shared Google Sheet via
 * its no-auth CSV export endpoint (the "sheet as API"), matches each player
 * to our roster by normalized name + team, and upserts a Madden snapshot per
 * matched player. Re-runnable: the sheet is the source of truth, so editing it
 * and re-running refreshes our data. Dry-run by default; pass --write.
 *
 * Usage:
 *   NEXT_PUBLIC_CONVEX_URL=<url> [CONVEX_ADMIN_KEY=<key>] \
 *     npx tsx apps/web/scripts/ingest-madden-ratings.mts \
 *       [--sheet-id <id>] [--gid 0] [--write]
 */
import { ConvexHttpClient } from "convex/browser";
import { rosterMatchKey, normalizeName } from "../src/lib/madden/match.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const SHEET_ID = arg("sheet-id") ?? "18i1BI1iAK0oAJG-nNQ9HS2mm2R92dI8axTxbBpPXjAc";
// Omit gid by default — the first tab's gid isn't always 0, and the bare
// export endpoint returns the first sheet. Pass --gid to target a specific tab.
const GID = arg("gid");
const WRITE = has("write");
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is required (point it at the target deployment).");
  process.exit(1);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  // Join physical lines that are split inside quoted cells.
  const rows: string[] = [];
  let buf = "";
  let quotes = 0;
  for (const line of text.split(/\r?\n/)) {
    buf = buf ? `${buf}\n${line}` : line;
    quotes += (line.match(/"/g) ?? []).length;
    if (quotes % 2 === 0) {
      if (buf.length) rows.push(buf);
      buf = "";
      quotes = 0;
    }
  }
  if (buf.length) rows.push(buf);
  if (rows.length === 0) return [];
  const headers = splitCsvLine(rows[0]);
  return rows.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

type MaddenEntry = {
  overall: number;
  position: string;
  attributesJson: string;
  portraitUrl: string | null;
  teamLogoUrl: string | null;
};

async function main() {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv` +
    (GID ? `&gid=${GID}` : "");
  console.log(`Madden ingest — ${WRITE ? "WRITE" : "DRY RUN"}\n  sheet ${url}\n  deployment ${CONVEX_URL}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Sheet fetch failed (${res.status}). Is it shared "anyone with link"?`);
    process.exit(1);
  }
  const sheet = parseCsv(await res.text());
  if (sheet.length === 0) {
    console.error("Sheet is empty.");
    process.exit(1);
  }
  const headers = Object.keys(sheet[0]);
  const logoIdx = headers.indexOf("Team Logo");
  const attrCols = logoIdx >= 0 ? headers.slice(logoIdx + 1) : [];

  // Build two Madden indexes: name+team (primary) and name-only (fallback for
  // players we and Madden have on different teams, e.g. a recent trade). The
  // name-only fallback is used only when the name is unique in the sheet.
  const maddenByKey = new Map<string, MaddenEntry>();
  const maddenByName = new Map<string, MaddenEntry[]>();
  for (const r of sheet) {
    const name = `${r["First Name"] ?? ""} ${r["Last Name"] ?? ""}`.trim();
    const team = r["Team"] ?? "";
    if (!name || !team) continue;
    const attributes: Record<string, number> = {};
    for (const col of attrCols) {
      if (col === "OVERALL") continue;
      const n = Number(r[col]);
      if (Number.isFinite(n)) attributes[col] = n;
    }
    const entry: MaddenEntry = {
      overall: Number(r["Overall"]) || 0,
      position: r["Position"] ?? "",
      attributesJson: JSON.stringify(attributes),
      portraitUrl: r["Player Image"] || null,
      teamLogoUrl: r["Team Logo"] || null,
    };
    maddenByKey.set(rosterMatchKey(name, team), entry);
    const nameKey = normalizeName(name);
    const list = maddenByName.get(nameKey) ?? [];
    list.push(entry);
    maddenByName.set(nameKey, list);
  }
  console.log(`  parsed ${maddenByKey.size} Madden players, ${attrCols.length} attribute columns`);

  function matchPlayer(name: string, team: string): MaddenEntry | null {
    const exact = maddenByKey.get(rosterMatchKey(name, team));
    if (exact) return exact;
    const byName = maddenByName.get(normalizeName(name));
    return byName && byName.length === 1 ? byName[0] : null;
  }

  const client = new ConvexHttpClient(CONVEX_URL!);
  const adminKey = process.env.CONVEX_ADMIN_KEY;
  if (adminKey) {
    (client as unknown as { setAdminAuth: (k: string) => void }).setAdminAuth(adminKey);
  }
  const q = (name: string, args: unknown) =>
    client.query(name as never, args as never) as Promise<unknown>;
  const m = (name: string, args: unknown) =>
    client.mutation(name as never, args as never) as Promise<unknown>;

  const leagues = (await q("sports:listPublicLeagues", {})) as { id: string; name: string }[];
  const rows: Array<{
    playerId: string;
    overall: number;
    position: string;
    attributesJson: string;
    portraitUrl: string | null;
    teamLogoUrl: string | null;
  }> = [];
  let rosterCount = 0;
  const unmatchedSample: string[] = [];

  for (const league of leagues) {
    const teams = (await q("sports:listTeamsByLeague", { leagueId: league.id })) as {
      id: string; name: string;
    }[];
    for (const team of teams) {
      const players = (await q("sports:listPlayersByTeam", { teamId: team.id })) as {
        id: string; name: string;
      }[];
      for (const p of players) {
        rosterCount += 1;
        const entry = matchPlayer(p.name, team.name);
        if (!entry) {
          if (unmatchedSample.length < 15) unmatchedSample.push(`${p.name} (${team.name})`);
          continue;
        }
        rows.push({ playerId: p.id, ...entry });
      }
    }
  }

  console.log(`  roster ${rosterCount} players · matched ${rows.length} · unmatched ${rosterCount - rows.length}`);
  if (unmatchedSample.length) {
    console.log(`  sample unmatched: ${unmatchedSample.slice(0, 10).join("; ")}`);
  }

  if (!WRITE) {
    console.log("DRY RUN — pass --write to ingest. No data written.");
    return;
  }
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const res2 = (await m("sports:ingestMaddenRatingsBatch", {
      rows: rows.slice(i, i + 500),
    })) as { created: number; updated: number };
    written += res2.created + res2.updated;
  }
  console.log(`Wrote ${written} Madden snapshots.`);
}

main().catch((e) => { console.error(e); process.exit(1); });

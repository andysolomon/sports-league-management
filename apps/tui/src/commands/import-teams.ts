import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { parse } from "csv-parse/sync";
import { getApiBaseUrl } from "../lib/config.js";
import { createTeam, type CreateTeamInput } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";

const REQUIRED_COLUMNS = ["name", "leagueId", "city", "stadium"] as const;

interface CsvRow {
  name?: string;
  leagueId?: string;
  city?: string;
  stadium?: string;
  [key: string]: string | undefined;
}

function validateRow(row: CsvRow, index: number): CreateTeamInput | string {
  const missing = REQUIRED_COLUMNS.filter((col) => !row[col]?.trim());
  if (missing.length > 0) {
    return `Row ${index + 1}: missing ${missing.join(", ")}`;
  }
  return {
    name: row.name!.trim(),
    leagueId: row.leagueId!.trim(),
    city: row.city!.trim(),
    stadium: row.stadium!.trim(),
  };
}

export async function runImportTeams(csvPath: string): Promise<void> {
  const creds = await readCredentials();
  if (!creds) {
    throw new Error("Not authenticated. Run 'pnpm tui login' first.");
  }

  // Read and parse CSV
  let raw: string;
  try {
    raw = await readFile(csvPath, "utf8");
  } catch (err) {
    throw new Error(
      `Cannot read file: ${csvPath} (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  const rows: CsvRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (rows.length === 0) {
    throw new Error("CSV file is empty or has no data rows.");
  }

  // Validate all rows
  const validated: (CreateTeamInput | string)[] = rows.map(validateRow);
  const errors = validated.filter((v): v is string => typeof v === "string");
  const valid = validated.filter(
    (v): v is CreateTeamInput => typeof v !== "string",
  );

  if (errors.length > 0) {
    console.log(`\nValidation errors (${errors.length}):`);
    errors.forEach((e) => console.log(`  ${e}`));
    console.log();
  }

  if (valid.length === 0) {
    throw new Error("No valid rows to import.");
  }

  // Preview
  console.log(`\nImport preview (${valid.length} teams):\n`);
  valid.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name} — ${t.city}, ${t.stadium} (league: ${t.leagueId})`);
  });
  if (valid.length > 5) {
    console.log(`  ...and ${valid.length - 5} more`);
  }
  console.log();

  // Confirm
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer: string;
  try {
    answer = (await rl.question(`Create ${valid.length} teams? [y/N] `)).trim().toLowerCase();
  } finally {
    rl.close();
  }

  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  // Import
  const baseUrl = getApiBaseUrl();
  let created = 0;
  let failed = 0;
  const failedRows: { name: string; error: string }[] = [];

  for (let i = 0; i < valid.length; i++) {
    const team = valid[i];
    console.log(`[${i + 1}/${valid.length}] Creating ${team.name}...`);
    try {
      await createTeam(baseUrl, creds.apiKey, team);
      created++;
    } catch (err) {
      failed++;
      failedRows.push({
        name: team.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Summary
  console.log(`\nImport complete: ${created} created, ${failed} failed.`);
  if (failedRows.length > 0) {
    console.log("\nFailed rows:");
    failedRows.forEach((r) => console.log(`  ${r.name}: ${r.error}`));
  }
}

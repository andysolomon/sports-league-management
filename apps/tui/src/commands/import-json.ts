import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { LeagueImportSchema } from "@sports-management/api-contracts";
import { getApiBaseUrl } from "../lib/config.js";
import { importJson } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";

export async function runImportJson(jsonPath: string): Promise<void> {
  const creds = await readCredentials();
  if (!creds) {
    throw new Error("Not authenticated. Run 'pnpm tui login' first.");
  }

  // Read JSON file
  let raw: string;
  try {
    raw = await readFile(jsonPath, "utf8");
  } catch (err) {
    throw new Error(
      `Cannot read file: ${jsonPath} (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  // Parse JSON
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("File is not valid JSON.");
  }

  // Validate against schema
  const parsed = LeagueImportSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    console.error(`\nValidation failed (${issues.length} error(s)):\n`);
    for (const issue of issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      console.error(`  ${path}: ${issue.message}`);
    }
    console.error();
    throw new Error("Fix the errors above and try again.");
  }

  // Preview
  const data = parsed.data;
  let teamCount = 0;
  let playerCount = 0;
  for (const div of data.divisions) {
    teamCount += div.teams.length;
    for (const team of div.teams) {
      playerCount += team.players.length;
    }
  }

  console.log(`\nImport preview:\n`);
  console.log(`  League:    ${data.league.name}`);
  console.log(`  Divisions: ${data.divisions.length}`);
  console.log(`  Teams:     ${teamCount}`);
  console.log(`  Players:   ${playerCount}`);
  console.log();

  // Confirm
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer: string;
  try {
    answer = (await rl.question("Proceed with import? [y/N] ")).trim().toLowerCase();
  } finally {
    rl.close();
  }

  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  // Import
  const baseUrl = getApiBaseUrl();
  console.log("\nImporting...");
  const result = await importJson(baseUrl, creds.apiKey, json);

  // Summary
  console.log("\nImport complete:");
  console.log(`  Leagues:   ${result.created.leagues} created, ${result.updated.leagues} updated`);
  console.log(`  Divisions: ${result.created.divisions} created, ${result.updated.divisions} updated`);
  console.log(`  Teams:     ${result.created.teams} created, ${result.updated.teams} updated`);
  console.log(`  Players:   ${result.created.players} created, ${result.updated.players} updated`);

  if (result.errors.length > 0) {
    console.log(`\n  Errors (${result.errors.length}):`);
    for (const err of result.errors) {
      console.log(`    ${err.entity} "${err.name}": ${err.message}`);
    }
  }
}

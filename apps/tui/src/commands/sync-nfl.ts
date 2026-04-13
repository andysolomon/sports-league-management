import { getApiBaseUrl } from "../lib/config.js";
import { syncNfl } from "../lib/api.js";
import { readCredentials } from "../lib/credentials.js";

export async function runSyncNfl(): Promise<void> {
  const creds = await readCredentials();
  if (!creds) {
    throw new Error("Not authenticated. Run 'pnpm tui login' first.");
  }

  const baseUrl = getApiBaseUrl();
  console.log("\nSyncing NFL data from ESPN...\n");

  const report = await syncNfl(baseUrl, creds.apiKey);

  // Duration
  const seconds = Math.round(report.durationMs / 1000);
  console.log(`Completed in ${seconds}s`);
  console.log(`  Started:   ${report.startedAt}`);
  console.log(`  Completed: ${report.completedAt}`);

  // Import result
  if (report.importResult) {
    const { created, updated } = report.importResult;
    console.log(`\nResults:`);
    console.log(`  Leagues:   ${created.leagues} created, ${updated.leagues} updated`);
    console.log(`  Divisions: ${created.divisions} created, ${updated.divisions} updated`);
    console.log(`  Teams:     ${created.teams} created, ${updated.teams} updated`);
    console.log(`  Players:   ${created.players} created, ${updated.players} updated`);

    if (report.importResult.errors.length > 0) {
      console.log(`\n  Import errors (${report.importResult.errors.length}):`);
      for (const err of report.importResult.errors) {
        console.log(`    ${err.entity} "${err.name}": ${err.message}`);
      }
    }
  } else {
    console.log("\nNo import result — sync may have been skipped or failed.");
  }

  // Adapter errors
  if (report.adapterErrors.length > 0) {
    console.log(`\n  Adapter errors (${report.adapterErrors.length}):`);
    for (const err of report.adapterErrors) {
      console.log(`    ${err}`);
    }
  }
}

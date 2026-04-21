/**
 * One-off: NFL ESPN → Salesforce import (same as POST /api/import/nfl-sync).
 * Usage from apps/web: pnpm dlx dotenv-cli -e .env.local -- pnpm dlx tsx scripts/run-nfl-sync-once.mts
 */
import { syncNfl } from "../src/lib/sync/nfl-sync.ts";

const report = await syncNfl({ skipToggleCheck: true });
console.log(JSON.stringify(report, null, 2));
process.exit(report.importResult === null ? 1 : 0);
